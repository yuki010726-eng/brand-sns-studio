import { CopyPage } from "../../text/page.jsx";
import { TemplatePage } from "../page.jsx";

export default async function Page({ params }) {
  const { mode } = await params;
  // Text-and-image work ends in the editable blog preview; the image route
  // remains the dedicated image/canvas workflow.
  if (mode === "text-image") return <CopyPage resultOnly />;
  return <TemplatePage key={mode} />;
}
