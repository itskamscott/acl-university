// Per ACL_University_Build_Spec.md §8 — product brand strings live here.
// Do not hardcode the brand name in components; import from here so the
// university rebrand can swap in one place.

export const PRODUCT_NAME = "ACL University";
export const PRODUCT_NAME_SHORT = "ACL U";
export const COMPANY_NAME = "Athlete Creator Lab";

// Legal-language status (§8): the "university avoids employing athletes"
// framing is under attorney review. Keep onboarding copy neutral —
// "ACL contracts the athlete; the school facilitates" — until cleared.
// Centralize copy here so the legal-approved wording can be swapped in
// one place once review completes.
export const ONBOARDING_LEGAL_BLURB =
  "ACL contracts and pays athletes directly. Your school helps facilitate the partnership.";
