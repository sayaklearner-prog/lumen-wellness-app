export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";

// ── backward-compat aliases ─────────────────────────────────────────────────
// The OpenAPI generator renamed get_my_profile → useGetMyProfile.
// Many screens still import the old names; re-export here so nothing breaks.
export {
  useGetMyProfile         as useGetProfile,
  getGetMyProfileQueryKey as getGetProfileQueryKey,
  getGetMyProfileQueryOptions as getGetProfileQueryOptions,
  useUpdateMyProfile      as useUpdateProfile,
} from "./generated/api";
