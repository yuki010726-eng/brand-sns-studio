"use client";

import { useEffect, useRef, useState } from "react";

const CHECK_INTERVAL = 30_000;

/**
 * Detects a newer server deployment without interrupting an in-progress AI
 * request. The user's generation settings live in store.js/localStorage, so a
 * normal page reload restores them after the update.
 */
export function DeploymentUpdateNotice({ initialVersion }) {
  const versionRef = useRef(initialVersion);
  const generatingRef = useRef(false);
  const updateWaitingRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let disposed = false;

    const showWhenSafe = () => {
      if (generatingRef.current) {
        updateWaitingRef.current = true;
        return;
      }
      setVisible(true);
    };

    const checkDeployment = async () => {
      // Development hot reloads must not be presented as a new deployment.
      if (process.env.NODE_ENV !== "production" || document.hidden) return;
      try {
        const response = await fetch("/api/deployment-version", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;
        const { version } = await response.json();
        if (!version || disposed) return;
        if (versionRef.current && versionRef.current !== version) showWhenSafe();
        versionRef.current = version;
      } catch {
        // A temporary network error should not disrupt the editor.
      }
    };

    const onGenerationChange = (event) => {
      generatingRef.current = Boolean(event.detail?.active);
      if (!generatingRef.current && updateWaitingRef.current) {
        updateWaitingRef.current = false;
        setVisible(true);
      }
    };

    checkDeployment();
    const timer = window.setInterval(checkDeployment, CHECK_INTERVAL);
    window.addEventListener("app:ai-generation", onGenerationChange);
    window.addEventListener("focus", checkDeployment);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("app:ai-generation", onGenerationChange);
      window.removeEventListener("focus", checkDeployment);
    };
  }, []);

  if (!visible) return null;

  return (
    <aside className="deployment-update-toast" role="status" aria-live="polite">
      <p>새로운 배포가 있어요. 최신 기능을 적용하려면 새로고침해 주세요.</p>
      <button type="button" onClick={() => window.location.reload()}>
        새로고침
      </button>
    </aside>
  );
}
