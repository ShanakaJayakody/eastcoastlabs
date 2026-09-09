"use server";

import {
  reviewCreatorApplication as review,
  type ReviewCreatorApplicationInput,
} from "@/lib/admin/creators";

export async function reviewCreatorApplication(input: ReviewCreatorApplicationInput) {
  return review(input);
}
