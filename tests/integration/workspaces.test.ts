import { describe, expect, it } from "vitest";
import { BadRequest, Conflict, Forbidden, NotFound } from "@/server/errors";
import { createLabel, getBoard } from "@/server/services/board";
import { acceptInvite, createInvite, removeMember, updateMemberRole } from "@/server/services/workspaces";
import { makeUser, setupWorkspace } from "./helpers";
import { createWorkspace } from "@/server/services/workspaces";

const APP = "http://localhost:3000";
const tokenOf = (link: string) => link.split("/invite/")[1];

describe("workspaces", () => {
  it("creator becomes admin; keys are unique", async () => {
    const { ws, alice } = await setupWorkspace();
    expect((await getBoard(alice, ws.slug)).role).toBe("admin");
    const other = await makeUser("Other");
    await expect(createWorkspace(other, { name: "Dup", key: ws.key })).rejects.toBeInstanceOf(Conflict);
  });
});

describe("invites", () => {
  it("an invite link adds the user with the invited role, once", async () => {
    const { ws, alice } = await setupWorkspace();
    const invite = await createInvite(alice, ws.slug, { role: "viewer" }, APP);
    expect(invite.link.startsWith(`${APP}/invite/`)).toBe(true);

    const dave = await makeUser("Dave");
    expect(await acceptInvite(dave, { token: tokenOf(invite.link) })).toEqual({ slug: ws.slug });
    expect((await getBoard(dave, ws.slug)).role).toBe("viewer");

    const eve = await makeUser("Eve");
    await expect(acceptInvite(eve, { token: tokenOf(invite.link) })).rejects.toBeInstanceOf(NotFound);
  });

  it("email-bound invites only work for that email", async () => {
    const { ws, alice } = await setupWorkspace();
    const frank = await makeUser("Frank");
    const invite = await createInvite(alice, ws.slug, { email: frank.email, role: "member" }, APP);
    const grace = await makeUser("Grace");
    await expect(acceptInvite(grace, { token: tokenOf(invite.link) })).rejects.toBeInstanceOf(Forbidden);
    await acceptInvite(frank, { token: tokenOf(invite.link) });
    expect((await getBoard(frank, ws.slug)).role).toBe("member");
  });

  it("only admins can invite", async () => {
    const { ws, bob } = await setupWorkspace();
    await expect(createInvite(bob, ws.slug, { role: "admin" }, APP)).rejects.toBeInstanceOf(Forbidden);
  });

  it("rejects unknown tokens", async () => {
    const someone = await makeUser("Someone");
    await expect(acceptInvite(someone, { token: "x".repeat(32) })).rejects.toBeInstanceOf(NotFound);
  });
});

describe("members", () => {
  it("admins change roles; the last admin can't be demoted or removed", async () => {
    const { ws, alice, bob } = await setupWorkspace();
    await updateMemberRole(alice, ws.slug, bob.userId, { role: "viewer" });
    expect((await getBoard(bob, ws.slug)).role).toBe("viewer");

    await expect(updateMemberRole(alice, ws.slug, alice.userId, { role: "member" })).rejects.toBeInstanceOf(BadRequest);
    await expect(removeMember(alice, ws.slug, alice.userId)).rejects.toBeInstanceOf(BadRequest);
  });

  it("members can leave but not remove others", async () => {
    const { ws, bob, carol } = await setupWorkspace();
    await expect(removeMember(bob, ws.slug, carol.userId)).rejects.toBeInstanceOf(Forbidden);
    await removeMember(carol, ws.slug, carol.userId);
    await expect(getBoard(carol, ws.slug)).rejects.toBeInstanceOf(NotFound);
  });
});

describe("labels", () => {
  it("only admins can create labels", async () => {
    const { ws, alice, bob, carol } = await setupWorkspace();
    await expect(createLabel(bob, ws.slug, { name: "Urgent", color: "#ef4444" })).rejects.toBeInstanceOf(Forbidden);
    await expect(createLabel(carol, ws.slug, { name: "Urgent", color: "#ef4444" })).rejects.toBeInstanceOf(Forbidden);
    const label = await createLabel(alice, ws.slug, { name: "Urgent", color: "#ef4444" });
    expect(label.name).toBe("Urgent");
  });
});
