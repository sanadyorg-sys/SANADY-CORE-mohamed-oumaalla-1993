import { KeyRound } from "lucide-react";
import { ActionButton } from "@/components/common/action-button";
import { resetUserMfa } from "@/server/actions/admin";

/** Lost phone: resets another person's two-factor authentication (logged in the activity log). */
export function MfaResetButton({ userId, size }: { userId: string; size?: "sm" | "md" }) {
  return (
    <ActionButton
      size={size}
      action={resetUserMfa.bind(null, userId)}
      confirm={{
        title: "Réinitialiser la double authentification ?",
        description:
          "À faire uniquement après avoir vérifié l’identité de la personne par un autre moyen (téléphone, en personne). Son mot de passe suffira alors pour se connecter, jusqu’à ce qu’elle configure à nouveau son application. L’action est inscrite au journal d’activité.",
        confirmLabel: "Réinitialiser",
        tone: "danger",
      }}
    >
      <KeyRound aria-hidden /> Réinitialiser la 2FA
    </ActionButton>
  );
}
