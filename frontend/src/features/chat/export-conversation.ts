import type { ChatDetail } from "@/types/api";

export function conversationToMarkdown(chat: ChatDetail): string {
  const lines = [`# ${chat.title}`, "", `_Exported from InsightIQ_`, ""];
  for (const m of chat.messages) {
    lines.push(m.role === "user" ? "## 🧑 You" : "## 🤖 InsightIQ");
    lines.push("");
    lines.push(m.content);
    if (m.result_type === "chart") lines.push("\n_[chart visualization]_");
    lines.push("");
  }
  return lines.join("\n");
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "conversation";
}

export function downloadMarkdown(chat: ChatDetail): void {
  const blob = new Blob([conversationToMarkdown(chat)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(chat.title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Open a print-ready window (users can Save as PDF from the print dialog). */
export function printConversation(chat: ChatDetail): void {
  const win = window.open("", "_blank", "width=800,height=1000");
  if (!win) return;
  const body = chat.messages
    .map(
      (m) =>
        `<div class="msg ${m.role}"><div class="who">${m.role === "user" ? "You" : "InsightIQ"}</div>` +
        `<div class="content">${escapeHtml(m.content).replace(/\n/g, "<br/>")}</div></div>`,
    )
    .join("");
  win.document.write(`<!doctype html><html><head><title>${escapeHtml(chat.title)}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#111}
      h1{font-size:22px} .msg{margin:18px 0;padding:14px 16px;border-radius:12px;border:1px solid #e5e7eb}
      .msg.user{background:#eef2ff} .who{font-weight:600;font-size:12px;color:#6b7280;margin-bottom:6px}
      .content{font-size:14px;line-height:1.6;white-space:pre-wrap}
    </style></head><body><h1>${escapeHtml(chat.title)}</h1>${body}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
