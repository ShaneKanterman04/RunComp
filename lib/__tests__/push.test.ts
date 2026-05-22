import { getVapidSubject } from "../push";

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
    delete process.env.VAPID_SUBJECT;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.PUBLIC_APP_URL;
  });

  afterEach(resetVapidEnv);

  it("uses a production-safe default subject", () => {
    expect(getVapidSubject()).toBe("mailto:runcomp@shanekanterman.dev");
  });

  it("keeps explicit mailto and https subjects", () => {
    process.env.VAPID_SUBJECT = "mailto:alerts@example.com";
    expect(getVapidSubject()).toBe("mailto:alerts@example.com");

    process.env.VAPID_SUBJECT = "https://run.example.com";
    expect(getVapidSubject()).toBe("https://run.example.com");
  });

  it("normalizes configured app URLs for push services", () => {
    process.env.NEXT_PUBLIC_APP_URL = "run.example.com";
    expect(getVapidSubject()).toBe("https://run.example.com");

    process.env.NEXT_PUBLIC_APP_URL = "http://run.example.com";
    expect(getVapidSubject()).toBe("https://run.example.com");
  });
});
