import { promises as fs } from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { formatMiles, formatPace } from "@/lib/run-metrics";
import { listPushSubscriptions, removePushSubscription, type PublicRunEntry } from "@/lib/store";

type VapidKeys = {
  publicKey: string;
  privateKey: string;
};

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const vapidFile = path.join(dataDir, "vapid.json");
const fallbackVapidSubject = "mailto:runcomp@shanekanterman.dev";
let cachedKeys: VapidKeys | null = null;

export async function getVapidPublicKey() {
  return (await getVapidKeys()).publicKey;
}

export async function notifyRunLogged(groupId: string, run: PublicRunEntry) {
  const subscriptions = await listPushSubscriptions(groupId);
  if (subscriptions.length === 0) return;

  const pace = run.durationSeconds ? ` at ${formatPace(run.durationSeconds / run.miles)}` : "";
  const payload = JSON.stringify({
    title: `${run.runner} logged ${formatMiles(run.miles)}`,
    body: `${run.note || "New family run"}${pace}`,
    url: "/",
    tag: `run-${run.id}`,
  });

  await configureWebPush();
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          payload,
        );
      } catch (error) {
        if (isExpiredSubscription(error)) {
          await removePushSubscription(groupId, subscription.endpoint).catch(() => undefined);
        } else {
          console.warn("Could not send push notification", error);
        }
      }
    }),
  );
}

async function configureWebPush() {
  const keys = await getVapidKeys();
  webpush.setVapidDetails(getVapidSubject(), keys.publicKey, keys.privateKey);
}

export function getVapidSubject() {
  const configuredSubject = process.env.VAPID_SUBJECT?.trim();
  if (configuredSubject) return normalizeVapidSubject(configuredSubject);

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.PUBLIC_APP_URL?.trim();
  if (configuredUrl) return normalizeVapidSubject(configuredUrl);

  return fallbackVapidSubject;
}

function normalizeVapidSubject(subject: string) {
  if (subject.startsWith("mailto:") || subject.startsWith("https://")) return subject;
  if (subject.startsWith("http://")) return subject.replace(/^http:\/\//, "https://");
  if (subject.includes(".")) return `https://${subject}`;
  return fallbackVapidSubject;
}

async function getVapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys;

  const envPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPrivate = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPublic && envPrivate) {
    cachedKeys = { publicKey: envPublic, privateKey: envPrivate };
    return cachedKeys;
  }

  try {
    const raw = await fs.readFile(vapidFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<VapidKeys>;
    if (parsed.publicKey && parsed.privateKey) {
      cachedKeys = { publicKey: parsed.publicKey, privateKey: parsed.privateKey };
      return cachedKeys;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const generated = webpush.generateVAPIDKeys();
  cachedKeys = { publicKey: generated.publicKey, privateKey: generated.privateKey };
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(vapidFile, `${JSON.stringify(cachedKeys, null, 2)}\n`, "utf8");
  return cachedKeys;
}

function isExpiredSubscription(error: unknown) {
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : 0;
  return statusCode === 404 || statusCode === 410;
}
