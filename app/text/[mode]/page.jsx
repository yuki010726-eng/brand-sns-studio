import { CopyPage } from "../page.jsx";

export default async function Page({ params }) {
  const { mode } = await params;
  return <CopyPage key={mode} />;
}
