export const CONTENT_MODE = {
  TEXT_IMAGE: "text-image",
  IMAGE: "image",
};

export const textPath = (mode = CONTENT_MODE.TEXT_IMAGE) => `/text/${mode}`;
export const templatePath = (mode = CONTENT_MODE.TEXT_IMAGE) =>
  `/template/${mode}`;

export function contentModeFromPath(mode) {
  return mode === CONTENT_MODE.IMAGE
    ? CONTENT_MODE.IMAGE
    : CONTENT_MODE.TEXT_IMAGE;
}
