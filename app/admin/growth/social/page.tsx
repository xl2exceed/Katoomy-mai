"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface SocialPost {
  id: string;
  platform: string;
  title: string;
  content: string;
  hashtags: string | null;
  status: string;
  source: string;
  generation_context: string | null;
  scheduled_for: string | null;
  created_at: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸",
  facebook: "👥",
  twitter: "🐦",
  tiktok: "🎵",
  linkedin: "💼",
  x: "🐦",
};

const STATUS_STYLES: Record<string, string> = {
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  scheduled: "bg-blue-100 text-blue-700",
  published: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
  draft: "bg-gray-100 text-gray-500",
};

const PLATFORMS = ["instagram", "facebook", "twitter", "tiktok", "linkedin"];

export default function SocialPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["instagram", "facebook"]);
  const [context, setContext] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending_approval");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadPosts = async (status = statusFilter) => {
    try {
      const res = await fetch(`/api/growth/social?status=${status}`);
      const json = await res.json();
      setPosts(json.posts ?? []);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    loadPosts().finally(() => setLoading(false));
  }, []);

  const handleFilterChange = (s: string) => {
    setStatusFilter(s);
    setLoading(true);
    loadPosts(s).finally(() => setLoading(false));
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const generatePosts = async () => {
    if (!selectedPlatforms.length) return;
    setGenerating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/growth/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: selectedPlatforms, context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setSuccessMsg(`✅ Generated ${json.generated} post${json.generated !== 1 ? "s" : ""}! Review them below.`);
      setContext("");
      setStatusFilter("pending_approval");
      await loadPosts("pending_approval");
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (postId: string, status: string) => {
    try {
      await fetch("/api/growth/social", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, status }),
      });
      await loadPosts();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">📱</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Media Posts</h1>
          <p className="text-sm text-gray-500">
            AI generates posts based on your business analytics — no topic input needed.
          </p>
        </div>
      </div>

      {/* Generate Panel */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-bold text-purple-800 mb-3">Generate New Posts</h2>

        {/* Platform Selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                selectedPlatforms.includes(p)
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
              }`}
            >
              <span>{PLATFORM_ICONS[p] ?? "📲"}</span>
              <span className="capitalize">{p}</span>
            </button>
          ))}
        </div>

        {/* Optional Context */}
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Optional: Add context for the AI (e.g. 'We have a summer sale this week' or 'Promote our new service'). Leave blank to let AI decide based on your analytics."
          rows={2}
          className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 mb-3"
        />

        <button
          onClick={generatePosts}
          disabled={generating || !selectedPlatforms.length}
          className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-40 transition"
        >
          {generating ? "Generating…" : `✨ Generate ${selectedPlatforms.length} Post${selectedPlatforms.length !== 1 ? "s" : ""}`}
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-800 text-sm font-semibold">{successMsg}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["pending_approval", "approved", "scheduled", "published", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => handleFilterChange(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition ${
              statusFilter === s
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-700 font-semibold">No posts with status &quot;{statusFilter.replace("_", " ")}&quot;</p>
          <p className="text-gray-500 text-sm mt-1">
            Generate new posts above or switch to a different filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{PLATFORM_ICONS[post.platform] ?? "📲"}</span>
                  <span className="text-sm font-bold text-gray-900 capitalize">{post.platform}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLES[post.status] ?? STATUS_STYLES.draft}`}>
                  {post.status.replace("_", " ")}
                </span>
              </div>

              {post.title && (
                <p className="text-sm font-semibold text-gray-800 mb-1">{post.title}</p>
              )}
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{post.content}</p>
              {post.hashtags && (
                <p className="text-xs text-indigo-500 mt-2">{post.hashtags}</p>
              )}
              {post.generation_context && (
                <p className="text-xs text-gray-400 mt-2 italic">
                  Based on: {post.generation_context}
                </p>
              )}

              {/* Actions */}
              {post.status === "pending_approval" && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => updateStatus(post.id, "approved")}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => updateStatus(post.id, "cancelled")}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200"
                  >
                    ✕ Dismiss
                  </button>
                </div>
              )}
              {post.status === "approved" && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => updateStatus(post.id, "published")}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
                  >
                    🚀 Mark as Published
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/admin/growth" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to AI Growth Hub
        </Link>
      </div>
    </div>
  );
}
