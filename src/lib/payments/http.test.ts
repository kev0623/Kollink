import { describe, expect, it } from "vitest";
import { MAX_NOTIFY_BYTES, readEcpayForm } from "./http";

const FORM = "application/x-www-form-urlencoded";

function chunked(text: string, headers: Record<string, string>): Request {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 1000) c.enqueue(bytes.slice(i, i + 1000));
      c.close();
    },
  });
  return new Request("http://localhost/x", {
    method: "POST", body: stream, headers, duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("readEcpayForm", () => {
  it("讀一般表單", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "a=1&b=%E4%B8%AD", headers: { "content-type": FORM } });
    expect(await readEcpayForm(req)).toEqual({ a: "1", b: "中" });
  });

  it("沒有 content-length（chunked）也能讀", async () => {
    const req = chunked("a=1&b=2", { "content-type": `${FORM}; charset=utf-8` });
    expect(req.headers.get("content-length")).toBeNull();
    expect(await readEcpayForm(req)).toEqual({ a: "1", b: "2" });
  });

  it("chunked 超過 64 KB 回傳 null", async () => {
    const req = chunked(`a=${"x".repeat(MAX_NOTIFY_BYTES + 10)}`, { "content-type": FORM });
    expect(await readEcpayForm(req)).toBeNull();
  });

  it("宣告的 content-length 超過上限回傳 null", async () => {
    const req = new Request("http://localhost/x", {
      method: "POST", body: "a=1", headers: { "content-type": FORM, "content-length": String(MAX_NOTIFY_BYTES + 1) },
    });
    expect(await readEcpayForm(req)).toBeNull();
  });

  it("content-type 不對回傳 null", async () => {
    const req = new Request("http://localhost/x", { method: "POST", body: "a=1", headers: { "content-type": "text/plain" } });
    expect(await readEcpayForm(req)).toBeNull();
    const json = new Request("http://localhost/x", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(await readEcpayForm(json)).toBeNull();
  });
});
