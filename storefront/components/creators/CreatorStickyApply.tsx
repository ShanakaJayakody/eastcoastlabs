"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/ui-context";
import { trackCreatorEvent } from "@/lib/analytics";
import styles from "@/app/(store)/creators/creators.module.css";

export default function CreatorStickyApply() {
  const { cartOpen } = useUI();
  const [heroVisible, setHeroVisible] = useState(true);
  const [applyVisible, setApplyVisible] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("[data-creator-hero-cta]");
    const apply = document.getElementById("apply");
    if (typeof IntersectionObserver === "undefined") {
      setHeroVisible(false);
      setApplyVisible(false);
      return;
    }
    const heroObserver = hero
      ? new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), {
          threshold: 0.1,
        })
      : null;
    const applyObserver = apply
      ? new IntersectionObserver(([entry]) => setApplyVisible(entry.isIntersecting), {
          threshold: 0.08,
          rootMargin: "0px 0px -20% 0px",
        })
      : null;
    if (hero && heroObserver) heroObserver.observe(hero);
    if (apply && applyObserver) applyObserver.observe(apply);
    return () => {
      heroObserver?.disconnect();
      applyObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    const updateFocus = () => {
      const active = document.activeElement;
      setFieldFocused(
        Boolean(active?.matches("input, textarea, select, [contenteditable='true']")),
      );
    };
    document.addEventListener("focusin", updateFocus);
    document.addEventListener("focusout", updateFocus);
    return () => {
      document.removeEventListener("focusin", updateFocus);
      document.removeEventListener("focusout", updateFocus);
    };
  }, []);

  useEffect(() => {
    const read = () =>
      setModalOpen(Boolean(document.querySelector("[role='dialog'][aria-modal='true']")));
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const visible = !heroVisible && !applyVisible && !fieldFocused && !cartOpen && !modalOpen;

  const activate = () => {
    trackCreatorEvent("creator_cta_click", { placement: "sticky" });
    document.getElementById("apply")?.scrollIntoView({ block: "start" });
    window.setTimeout(() => {
      document.getElementById("creator-apply-title")?.focus({ preventScroll: true });
    }, 80);
  };

  return (
    <div className={`${styles.stickyApply} ${visible ? styles.stickyApplyVisible : ""}`}>
      <button
        type="button"
        onClick={activate}
        className={styles.stickyApplyButton}
        disabled={!visible}
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
      >
        Apply to the collective
        <span aria-hidden="true">-&gt;</span>
      </button>
    </div>
  );
}
