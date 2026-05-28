import webpush from "web-push";
import { getVapidSubject, notifyChallengeCompleted, notifyLeadChanged, notifyRunLogged } from "../push";
import { listPushSubscriptions, removePushSubscription } from "../store";

jest.mock("web-push", () => ({
  __esModule: true,
  default: {
    generateVAPIDKeys: jest.fn(() => ({ publicKey: "generated-public-key", privateKey: "generated-private-key" })),
    sendNotification: jest.fn(),
    setVapidDetails: jest.fn(),
  },
}));

jest.mock("../store", () => ({
  listPushSubscriptions: jest.fn(),
  removePushSubscription: jest.fn(),
}));

const originalEnv = {
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
};

function resetVapidEnv() {
  for (const key of Object.keys(originalEnv) as Array<keyof typeof originalEnv>) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("push notification VAPID config", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.VAPID_SUBJECT;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.PUBLIC_APP_URL;
    process.env.VAPID_PUBLIC_KEY = "public-key";
    process.env.VAPID_PRIVATE_KEY = "private-key";
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    resetVapidEnv();
  });

  it("uses a production-safe default subject", () => {
    expect(getVapidSubject()).toBe("mailto:runcomp@shanekanterman.dev");
  });

  it("keeps explicit mailto and https subjects", () => {
    process.env.VAPID_SUBJECT = "mailto:alerts@example.com";
    expect(getVapidSubject()).toBe("mailto:alerts@example.com");

    process.env.VAPID_SUBJECT = "MAILTO:Alerts@Example.com";
    expect(getVapidSubject()).toBe("mailto:Alerts@Example.com");

    process.env.VAPID_SUBJECT = "https://run.example.com";
    expect(getVapidSubject()).toBe("https://run.example.com");

    process.env.VAPID_SUBJECT = "HTTPS://Run.Example.com";
    expect(getVapidSubject()).toBe("https://Run.Example.com");
  });

  it("normalizes configured app URLs for push services", () => {
    process.env.NEXT_PUBLIC_APP_URL = "run.example.com";
    expect(getVapidSubject()).toBe("https://run.example.com");

    process.env.NEXT_PUBLIC_APP_URL = "http://run.example.com";
    expect(getVapidSubject()).toBe("https://run.example.com");

    process.env.NEXT_PUBLIC_APP_URL = "HTTP://Run.Example.com";
    expect(getVapidSubject()).toBe("https://Run.Example.com");

    process.env.NEXT_PUBLIC_APP_URL = "HTTPS://Run.Example.com";
    expect(getVapidSubject()).toBe("https://Run.Example.com");
  });

  it("sends run notification payloads to each group subscription", async () => {
    jest.mocked(listPushSubscriptions).mockResolvedValue([
      {
        endpoint: "https://push.example.test/one",
        keys: { p256dh: "key-one", auth: "auth-one" },
        memberId: "member-1",
        createdAt: "2026-05-22T12:00:00Z",
        updatedAt: "2026-05-22T12:00:00Z",
      },
      {
        endpoint: "https://push.example.test/two",
        keys: { p256dh: "key-two", auth: "auth-two" },
        memberId: "member-2",
        createdAt: "2026-05-22T12:00:00Z",
        updatedAt: "2026-05-22T12:00:00Z",
      },
    ]);
    jest.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201 } as never);

    await notifyRunLogged("group-1", {
      id: "run-1",
      memberId: "member-1",
      runner: "Molly",
      miles: 3.25,
      durationSeconds: 1560,
      date: "2026-05-22",
      note: "tempo",
      createdAt: "2026-05-22T12:00:00Z",
      reactions: [],
    });

    expect(webpush.setVapidDetails).toHaveBeenCalledWith("mailto:runcomp@shanekanterman.dev", "public-key", "private-key");
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example.test/one", keys: { p256dh: "key-one", auth: "auth-one" } },
      JSON.stringify({
        title: "Molly logged 3.25 mi",
        body: "tempo at 8:00 /mi",
        url: "/",
        tag: "run-run-1",
      }),
    );
  });

  it("omits pace from run notifications when legacy mileage is non-positive", async () => {
    jest.mocked(listPushSubscriptions).mockResolvedValue([
      {
        endpoint: "https://push.example.test/legacy",
        keys: { p256dh: "key-one", auth: "auth-one" },
        memberId: "member-1",
        createdAt: "2026-05-22T12:00:00Z",
        updatedAt: "2026-05-22T12:00:00Z",
      },
    ]);
    jest.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201 } as never);

    await notifyRunLogged("group-1", {
      id: "legacy-run",
      memberId: "member-1",
      runner: "Molly",
      miles: 0,
      durationSeconds: 1200,
      date: "2026-05-22",
      note: "legacy import",
      createdAt: "2026-05-22T12:00:00Z",
      reactions: [],
    });

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example.test/legacy", keys: { p256dh: "key-one", auth: "auth-one" } },
      JSON.stringify({
        title: "Molly logged 0 mi",
        body: "legacy import",
        url: "/",
        tag: "run-legacy-run",
      }),
    );
  });

  it("sends challenge completion payloads with winner context", async () => {
    jest.mocked(listPushSubscriptions).mockResolvedValue([
      {
        endpoint: "https://push.example.test/challenge",
        keys: { p256dh: "key-one", auth: "auth-one" },
        memberId: "member-1",
        createdAt: "2026-05-22T12:00:00Z",
        updatedAt: "2026-05-22T12:00:00Z",
      },
    ]);
    jest.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201 } as never);

    await notifyChallengeCompleted("group-1", {
      id: "2026-05-25:weekly-mileage",
      type: "weekly-mileage",
      title: "Weekly miles",
      body: "The group hit 20 miles this week.",
      label: "20 mi",
      value: 20,
      target: 20,
      progress: 1,
      complete: true,
      weekKey: "2026-05-25",
      tone: "green",
      completedAt: "2026-05-27",
      winner: "Molly",
    });

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example.test/challenge", keys: { p256dh: "key-one", auth: "auth-one" } },
      JSON.stringify({
        title: "Weekly miles complete",
        body: "Molly sealed it. The group hit 20 miles this week.",
        url: "/",
        tag: "challenge-2026-05-25:weekly-mileage",
      }),
    );
  });

  it("removes expired subscriptions and keeps non-expired failures", async () => {
    jest.mocked(removePushSubscription).mockResolvedValue({ removed: 1 });
    jest.mocked(listPushSubscriptions).mockResolvedValue([
      {
        endpoint: "https://push.example.test/expired",
        keys: { p256dh: "key-one", auth: "auth-one" },
        memberId: "member-1",
        createdAt: "2026-05-22T12:00:00Z",
        updatedAt: "2026-05-22T12:00:00Z",
      },
      {
        endpoint: "https://push.example.test/transient",
        keys: { p256dh: "key-two", auth: "auth-two" },
        memberId: "member-2",
        createdAt: "2026-05-22T12:00:00Z",
        updatedAt: "2026-05-22T12:00:00Z",
      },
    ]);
    jest
      .mocked(webpush.sendNotification)
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockRejectedValueOnce({ statusCode: 500 });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await notifyLeadChanged("group-1", "Shane", 12);

    expect(removePushSubscription).toHaveBeenCalledWith("group-1", "https://push.example.test/expired", "member-1");
    expect(removePushSubscription).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("Could not send push notification", { statusCode: 500 });
    warn.mockRestore();
  });
});
