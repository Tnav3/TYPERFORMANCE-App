import { CoachShellIfCoach } from "@/components/CoachShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CoachShellIfCoach>{children}</CoachShellIfCoach>;
}
