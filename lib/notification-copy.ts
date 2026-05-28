export type PushStatus = "checking" | "unsupported" | "off" | "subscribed" | "denied" | "busy";

type DeviceContext = {
  isIosDevice?: boolean;
  isStandaloneApp?: boolean;
};

export function notificationPromptCopy(status: PushStatus, groupName: string, context: DeviceContext = {}) {
  const displayGroupName = groupName.trim() || "your group";

  if (status === "checking") {
    return {
      eyebrow: "Run alerts",
      title: "Checking this device",
      body: "RunComp is checking whether this device can receive group run notifications.",
      status: "Checking",
      action: "Checking...",
    };
  }

  if (status === "busy") {
    return {
      eyebrow: "Run alerts",
      title: "Turning alerts on",
      body: "Approve the browser prompt to get notified when your group logs runs.",
      status: "Working",
      action: "Turning on...",
    };
  }

  if (status === "subscribed") {
    return {
      eyebrow: "Run alerts",
      title: "Group notifications are on",
      body: `This device will get alerts when anyone in ${displayGroupName} logs runs or changes the race.`,
      status: "On",
      action: "Alerts on",
    };
  }

  if (status === "denied") {
    return {
      eyebrow: "Run alerts",
      title: "Notifications are blocked",
      body: "RunComp cannot ask again from here. Allow notifications for this site in device or browser settings, then return to this screen.",
      status: "Blocked",
      action: "Blocked in settings",
    };
  }

  if (status === "unsupported") {
    const onIosBrowser = context.isIosDevice === true && context.isStandaloneApp !== true;
    return {
      eyebrow: "Run alerts",
      title: onIosBrowser ? "Open RunComp from your Home Screen" : "Notifications are not available here",
      body: onIosBrowser
        ? "iPhone push alerts work from the installed Home Screen app. Add RunComp there, open that icon, then enable alerts."
        : "This browser or device does not expose web push notifications to RunComp.",
      status: onIosBrowser ? "Home Screen needed" : "Unavailable",
      action: onIosBrowser ? "Needs Home Screen app" : "Unavailable",
      steps: onIosBrowser ? ["Tap Share in Safari.", "Choose Add to Home Screen.", "Open RunComp from the new icon."] : undefined,
    };
  }

  return {
    eyebrow: "Run alerts",
    title: "Turn on group notifications",
    body: `Get a notification on this device when anyone in ${displayGroupName} logs a run.`,
    status: "Off",
    action: "Turn on notifications",
  };
}

export function notificationSettingsCopy(status: PushStatus, context: DeviceContext = {}) {
  switch (status) {
    case "checking":
      return {
        title: "Checking this device",
        body: "RunComp is checking this browser's alert subscription.",
      };
    case "busy":
      return {
        title: "Updating alerts",
        body: "RunComp is updating this device's push subscription.",
      };
    case "subscribed":
      return {
        title: "Alerts are on",
        body: "This device is subscribed to run, lead-change, close-call, and challenge alerts.",
      };
    case "denied":
      return {
        title: "Alerts are blocked",
        body: "Allow notifications in browser or device settings, then return to RunComp.",
      };
    case "unsupported":
      return {
        title: "Alerts are unavailable",
        body:
          context.isIosDevice === true && context.isStandaloneApp !== true
            ? "Install RunComp to the Home Screen, then open that icon to enable iPhone alerts."
            : "This browser or device does not support RunComp push alerts.",
      };
    default:
      return {
        title: "Alerts are off",
        body: "Turn on alerts on this device to hear about family runs and race changes.",
      };
  }
}

export function installSettingsCopy(context: DeviceContext = {}) {
  if (context.isStandaloneApp === true) {
    return {
      title: "Opening like an app",
      body: "RunComp is running from an installed app window on this device.",
    };
  }

  if (context.isIosDevice === true) {
    return {
      title: "Browser mode",
      body: "Add RunComp to the Home Screen for app-style launch and iPhone push alerts.",
    };
  }

  return {
    title: "Browser mode",
    body: "RunComp can be installed from this browser's app or install menu when supported.",
  };
}

export function pushButtonLabel(status: PushStatus) {
  switch (status) {
    case "checking":
      return "Checking alerts...";
    case "busy":
      return "Updating alerts...";
    case "subscribed":
      return "Turn off alerts";
    case "denied":
      return "Alerts blocked";
    case "unsupported":
      return "Alerts unavailable";
    case "off":
      return "Turn on alerts";
    default:
      return "Turn on alerts";
  }
}
