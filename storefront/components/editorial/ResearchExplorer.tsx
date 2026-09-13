"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Collection } from "@/lib/collections";

export type CollectionPreview = Collection & {
  image?: string;
  productName?: string;
};

export default function ResearchExplorer({
  collections,
}: {
  collections: CollectionPreview[];
}) {
  const [active, setActive] = useState(0);
  const current = collections[active];
  if (!current) return null;
  return (
    <section
      className="ecl-paper ecl-section ecl-explore"
      aria-labelledby="explore-title"
    >
      <div className="ecl-container">
        <div className="ecl-section-heading" data-reveal>
          <div>
            <p className="ecl-eyebrow">02 / FOLLOW YOUR CURIOSITY</p>
            <h2 id="explore-title">
              Every question.
              <br />
              <em>A new direction.</em>
            </h2>
          </div>
          <p className="ecl-heading-note">
            Discover compounds by research area.
            <br />
            Find a starting point for your next study.
          </p>
        </div>
        <div className="ecl-explorer-grid" data-reveal>
          <div className="ecl-collection-visual">
            <span className="ecl-visual-tag">ECL / RESEARCH SERIES</span>
            {collections.map(
              (collection, index) =>
                collection.image && (
                  <Image
                    key={collection.slug}
                    src={collection.image}
                    alt={
                      index === active
                        ? `${collection.productName} — ${collection.name} collection`
                        : ""
                    }
                    aria-hidden={index !== active}
                    fill
                    sizes="(max-width: 760px) 90vw, 42vw"
                    className={`ecl-collection-image ${index === active ? "is-active" : ""}`}
                  />
                ),
            )}
            <div className="ecl-visual-caption">
              <span>
                0{active + 1} / 0{collections.length}
              </span>
              <p>{current.productName || current.name}</p>
              <span>RESEARCH USE ONLY</span>
            </div>
          </div>
          <div className="ecl-collection-list">
            {collections.map((collection, index) => (
              <div
                key={collection.slug}
                className={`ecl-collection-row ${index === active ? "is-active" : ""}`}
              >
                <button
                  type="button"
                  aria-pressed={index === active}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                  aria-label={`Preview ${collection.name}`}
                >
                  <span className="ecl-row-index">0{index + 1}</span>
                  <span>
                    <strong>{collection.name}</strong>
                    <small>{collection.tagline}</small>
                  </span>
                </button>
                <Link
                  href={`/collections/${collection.slug}`}
                  aria-label={`Shop ${collection.name}`}
                  className="ecl-collection-arrow"
                >
                  <ArrowUpRight size={22} strokeWidth={1.4} />
                </Link>
              </div>
            ))}
            <p className="ecl-collection-note">
              For laboratory research only. Collection names describe research
              fields, not intended personal use.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
