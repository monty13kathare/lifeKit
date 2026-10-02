import type { Metadata } from "next"
import { BookmarkManager } from "@/components/tools/bookmarks/bookmark-manager"

export const metadata: Metadata = {
  title: "Bookmarks",
  description: "Save useful links with categories and tags — stored privately in your browser.",
}

export default function BookmarksPage() {
  return <BookmarkManager />
}
