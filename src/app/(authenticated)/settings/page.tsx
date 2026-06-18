import { getAthleteOrRedirect } from "@/lib/get-athlete";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { athlete } = await getAthleteOrRedirect();
  return <SettingsClient athlete={athlete} />;
}
