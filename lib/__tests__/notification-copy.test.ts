import { installSettingsCopy, notificationPromptCopy, notificationSettingsCopy, pushButtonLabel } from "../notification-copy";

describe("notification copy", () => {
  it("describes subscribed devices as already enabled", () => {
    expect(notificationPromptCopy("subscribed", "Family Miles")).toMatchObject({
      title: "Group notifications are on",
      body: "This device will get alerts when anyone in Family Miles logs runs or changes the race.",
      status: "On",
      action: "Alerts on",
    });
    expect(pushButtonLabel("subscribed")).toBe("Alerts on");
  });

  it("explains iOS browser limitations separately from unsupported browsers", () => {
    expect(notificationPromptCopy("unsupported", "Family Miles", { isIosDevice: true, isStandaloneApp: false })).toMatchObject({
      title: "Open RunComp from your Home Screen",
      status: "Home Screen needed",
      steps: ["Tap Share in Safari.", "Choose Add to Home Screen.", "Open RunComp from the new icon."],
    });
    expect(notificationSettingsCopy("unsupported", { isIosDevice: true, isStandaloneApp: false }).body).toContain("Home Screen");
    expect(notificationPromptCopy("unsupported", "Family Miles", { isIosDevice: false }).title).toBe("Notifications are not available here");
  });

  it("keeps install status copy device-aware", () => {
    expect(installSettingsCopy({ isStandaloneApp: true }).title).toBe("Opening like an app");
    expect(installSettingsCopy({ isIosDevice: true, isStandaloneApp: false }).body).toContain("Home Screen");
    expect(installSettingsCopy({ isIosDevice: false, isStandaloneApp: false }).body).toContain("install menu");
  });
});
