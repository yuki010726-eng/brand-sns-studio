import { TemplatePage } from "../page.jsx";

export default async function Page({ params }) {
  const { mode } = await params;
  return <TemplatePage key={mode} />;
}
