import type { Nodes, PhrasingContent, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { ReactNode } from "react";
import { useMemo } from "react";

const SLIDE_LINK_PREFIX = "#/";

/**
 * Shows a slide's speaker notes, turning the CommonMark into React elements by the rules of
 * PRES-R10: HTML shows as written, images show their alternative text, links to slides go
 * through the audience window, and other links show their URL instead of opening.
 */
export function Notes({
  markdown,
  onSlideLinkClick,
}: {
  markdown: string | null;
  onSlideLinkClick: (hash: string) => void;
}) {
  const root = useMemo(
    () => (markdown === null || markdown.trim() === "" ? null : fromMarkdown(markdown)),
    [markdown],
  );
  if (root === null) return <p className="text-neutral-400">這一頁沒有備註</p>;
  const context: RenderContext = {
    urlByIdentifier: makeUrlByIdentifier(root.children),
    onSlideLinkClick,
  };
  return (
    <div className="flex flex-col gap-4">{renderNodes(root.children, context)}</div>
  );
}

type RenderContext = {
  urlByIdentifier: Map<string, string>;
  onSlideLinkClick: (hash: string) => void;
};

function renderNodes(nodes: RootContent[], context: RenderContext): ReactNode[] {
  return nodes.map((node, index) => renderNode(node, index, context));
}

function renderNode(node: RootContent, key: number, context: RenderContext): ReactNode {
  switch (node.type) {
    case "paragraph":
      return <p key={key}>{renderNodes(node.children, context)}</p>;
    case "heading":
      return (
        <p key={key} className="font-bold">
          {renderNodes(node.children, context)}
        </p>
      );
    case "thematicBreak":
      return <hr key={key} className="border-neutral-600" />;
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="flex flex-col gap-4 border-l-4 border-neutral-500 pl-4"
        >
          {renderNodes(node.children, context)}
        </blockquote>
      );
    case "list": {
      const ListTag = node.ordered === true ? "ol" : "ul";
      return (
        <ListTag
          key={key}
          start={node.start ?? undefined}
          className={`flex flex-col gap-2 pl-10 ${node.ordered === true ? "list-decimal" : "list-disc"}`}
        >
          {renderNodes(node.children, context)}
        </ListTag>
      );
    }
    case "listItem":
      return (
        <li key={key}>
          <div className="flex flex-col gap-2">
            {renderNodes(node.children, context)}
          </div>
        </li>
      );
    case "code":
      // Scrolls sideways when a line is wider than the notes (PRES-R3).
      return (
        <pre
          key={key}
          className="overflow-x-auto rounded bg-neutral-800 p-4 text-[0.8em]"
        >
          <code>{node.value}</code>
        </pre>
      );
    case "html":
      // HTML in the notes shows as written (PRES-R10).
      return (
        <span key={key} className="whitespace-pre-wrap">
          {node.value}
        </span>
      );
    case "definition":
      return null;
    case "text":
      return node.value;
    case "emphasis":
      return <em key={key}>{renderNodes(node.children, context)}</em>;
    case "strong":
      return <strong key={key}>{renderNodes(node.children, context)}</strong>;
    case "inlineCode":
      return (
        <code key={key} className="rounded bg-neutral-800 px-1.5 text-[0.9em]">
          {node.value}
        </code>
      );
    case "break":
      return <br key={key} />;
    case "image":
    case "imageReference":
      // Images do not show, since a relative path does not go through Vite and an external
      // URL needs a network (PRES-R10).
      return node.alt;
    case "link":
      return renderLink(node.url, node.children, key, context);
    case "linkReference":
      return renderLink(
        context.urlByIdentifier.get(node.identifier) ?? "",
        node.children,
        key,
        context,
      );
    default:
      // CommonMark without extensions produces no other node.
      throw new Error(`Speaker notes contain an unexpected "${node.type}" node`);
  }
}

function renderLink(
  url: string,
  children: PhrasingContent[],
  key: number,
  context: RenderContext,
): ReactNode {
  const content = renderNodes(children, context);
  if (url.startsWith(SLIDE_LINK_PREFIX)) {
    // Not an `<a href>`, so the browser offers no way to open the link in a new tab, which
    // would show a page asking to open the presenter window. Without a tab index, the link
    // never takes focus and leaves Space and Enter to the shortcuts (PRES-R11).
    const followLink = () => context.onSlideLinkClick(url);
    return (
      <span
        key={key}
        role="link"
        className="cursor-pointer text-sky-300 underline"
        // Keeps a click from focusing anything, and a middle click from starting autoscroll.
        onMouseDown={(event) => event.preventDefault()}
        onClick={followLink}
        onAuxClick={(event) => {
          if (event.button === 1) followLink();
        }}
      >
        {content}
      </span>
    );
  }
  // Other links do not open, since a new tab could join the audience window's browser
  // window and replace the slide on the projector (PRES-R10).
  if (getPlainText(children) === url) return <span key={key}>{url}</span>;
  return (
    <span key={key}>
      {content}（{url}）
    </span>
  );
}

/**
 * Maps each link reference definition's identifier to its URL. A definition can sit inside a
 * list item or a block quote, and the first definition of an identifier wins, as in CommonMark.
 */
function makeUrlByIdentifier(
  nodes: Nodes[],
  urlByIdentifier = new Map<string, string>(),
): Map<string, string> {
  for (const node of nodes) {
    if (node.type === "definition" && !urlByIdentifier.has(node.identifier)) {
      urlByIdentifier.set(node.identifier, node.url);
    }
    if ("children" in node) makeUrlByIdentifier(node.children, urlByIdentifier);
  }
  return urlByIdentifier;
}

function getPlainText(nodes: Nodes[]): string {
  return nodes
    .map((node) => {
      if ("value" in node) return node.value;
      if (node.type === "image" || node.type === "imageReference")
        return node.alt ?? "";
      return "children" in node ? getPlainText(node.children) : "";
    })
    .join("");
}
