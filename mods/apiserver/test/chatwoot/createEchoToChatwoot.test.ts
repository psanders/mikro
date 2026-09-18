/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createEchoToChatwoot } from "../../src/api/chatwoot/createEchoToChatwoot.js";

const json = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  }) as any;

const configured = {
  url: "https://chat.example.com/",
  accountId: 1,
  inboxId: 7,
  apiToken: "tok"
};

const echo = { phone: "18298717987", content: "¡Hola! Soy José.", sourceId: "wamid.ABC" };

/** Routes the three Chatwoot endpoints the echo touches to canned responses. */
function chatwoot(opts: { contacts?: unknown[]; conversations?: unknown[]; postStatus?: number }) {
  return sinon.stub().callsFake(async (url: string, init?: RequestInit) => {
    if (url.includes("/contacts/search")) return json({ payload: opts.contacts ?? [] });
    if (url.match(/\/contacts\/\d+\/conversations$/))
      return json({ payload: opts.conversations ?? [] });
    if (url.match(/\/conversations\/\d+\/messages$/) && init?.method === "POST")
      return json({ id: 99 }, opts.postStatus ?? 200);
    throw new Error(`unexpected request ${url}`);
  });
}

const contact = { id: 42, phone_number: "+18298717987" };

describe("createEchoToChatwoot", () => {
  afterEach(() => sinon.restore());

  it("posts the reply as an outgoing message carrying the wamid as source_id", async () => {
    const fetchFn = chatwoot({
      contacts: [contact],
      conversations: [{ id: 5, inbox_id: 7, status: "open", last_activity_at: 100 }]
    });
    const send = createEchoToChatwoot({ ...configured, fetchFn: fetchFn as any });

    expect(await send(echo)).to.be.true;

    const post = fetchFn.getCalls().find((c) => c.args[1]?.method === "POST")!;
    expect(post.args[0]).to.equal(
      "https://chat.example.com/api/v1/accounts/1/conversations/5/messages"
    );
    expect(post.args[1].headers.api_access_token).to.equal("tok");
    // source_id is what stops Chatwoot from delivering the message a second time.
    expect(JSON.parse(post.args[1].body)).to.deep.equal({
      content: "¡Hola! Soy José.",
      message_type: "outgoing",
      private: false,
      source_id: "wamid.ABC"
    });
  });

  it("never echoes a send without a wamid, since Chatwoot would re-send it", async () => {
    const fetchFn = chatwoot({});
    const send = createEchoToChatwoot({ ...configured, fetchFn: fetchFn as any });

    expect(await send({ ...echo, sourceId: undefined })).to.be.false;
    expect(fetchFn.called).to.be.false;
  });

  it("does nothing when unconfigured", async () => {
    const fetchFn = chatwoot({});
    const send = createEchoToChatwoot({ ...configured, apiToken: "", fetchFn: fetchFn as any });

    expect(await send(echo)).to.be.false;
    expect(fetchFn.called).to.be.false;
  });

  it("picks the most recent non-resolved conversation in the configured inbox", async () => {
    const fetchFn = chatwoot({
      contacts: [contact],
      conversations: [
        { id: 1, inbox_id: 7, status: "resolved", last_activity_at: 900 },
        { id: 2, inbox_id: 3, status: "open", last_activity_at: 800 },
        { id: 3, inbox_id: 7, status: "pending", last_activity_at: 500 },
        { id: 4, inbox_id: 7, status: "open", last_activity_at: 200 }
      ]
    });
    const send = createEchoToChatwoot({ ...configured, fetchFn: fetchFn as any });

    await send(echo);

    const post = fetchFn.getCalls().find((c) => c.args[1]?.method === "POST")!;
    expect(post.args[0]).to.match(/\/conversations\/3\/messages$/);
  });

  it("ignores contacts whose number only partially matches the search", async () => {
    const fetchFn = chatwoot({
      contacts: [{ id: 9, phone_number: "+118298717987" }],
      conversations: [{ id: 5, inbox_id: 7, status: "open" }]
    });
    const sleep = sinon.stub().resolves();
    const send = createEchoToChatwoot({ ...configured, fetchFn: fetchFn as any, sleep });

    expect(await send(echo)).to.be.false;
  });

  it("retries the lookup while Chatwoot is still creating the conversation", async () => {
    let searches = 0;
    const fetchFn = sinon.stub().callsFake(async (url: string, init?: RequestInit) => {
      if (url.includes("/contacts/search")) {
        searches++;
        return json({ payload: searches < 3 ? [] : [contact] });
      }
      if (url.endsWith("/contacts/42/conversations"))
        return json({ payload: [{ id: 5, inbox_id: 7, status: "open" }] });
      if (init?.method === "POST") return json({ id: 1 });
      throw new Error(url);
    });
    const sleep = sinon.stub().resolves();
    const send = createEchoToChatwoot({ ...configured, fetchFn: fetchFn as any, sleep });

    expect(await send(echo)).to.be.true;
    expect(searches).to.equal(3);
    expect(sleep.callCount).to.equal(2);
  });

  it("gives up after the configured attempts without throwing", async () => {
    const fetchFn = chatwoot({ contacts: [] });
    const sleep = sinon.stub().resolves();
    const send = createEchoToChatwoot({
      ...configured,
      fetchFn: fetchFn as any,
      sleep,
      attempts: 3
    });

    expect(await send(echo)).to.be.false;
    expect(fetchFn.callCount).to.equal(3);
  });

  it("swallows Chatwoot errors so the bot is never affected", async () => {
    const fetchFn = chatwoot({
      contacts: [contact],
      conversations: [{ id: 5, inbox_id: 7, status: "open" }],
      postStatus: 500
    });
    const send = createEchoToChatwoot({ ...configured, fetchFn: fetchFn as any });

    expect(await send(echo)).to.be.false;
  });
});
