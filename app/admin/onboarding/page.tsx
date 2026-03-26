// file: app/admin/onboarding/page.tsx

"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Message {
  role: "assistant" | "user";
  content: string;
}

export default function OnboardingPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const conversationHistory = useRef<Array<{ role: string; content: string }>>(
    []
  );

  useEffect(() => {
    initOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initOnboarding = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    let { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_user_id", user.id)
      .single();

    if (!business) {
      const slug = `business-${Math.random().toString(36).substr(2, 9)}`;
      const { data: newBusiness } = await supabase
        .from("businesses")
        .insert({
          owner_user_id: user.id,
          slug,
          name: "My Business",
          app_name: "My Business",
        })
        .select()
        .single();

      business = newBusiness;

      await supabase.from("business_features").insert({
        business_id: business.id,
      });

      await supabase.from("onboarding_state").insert({
        business_id: business.id,
        current_step: "welcome",
        mode: "fast",
      });
    }

    setBusinessId(business.id);

    setMessages([
      {
        role: "assistant",
        content:
          "Welcome! I'll help you set up your booking app in just a few minutes. What's the name of your business?",
      },
    ]);
  };

  const handleSend = async () => {
    if (!input.trim() || !businessId || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/onboarding-agent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            business_id: businessId,
            message: userMessage,
            conversation_history: conversationHistory.current,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Edge Function error:", errorText);
        throw new Error(`Edge Function failed: ${response.status}`);
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);

      conversationHistory.current = data.conversation_history || [];

      if (data.next_step === "done") {
        setTimeout(() => {
          router.push("/admin");
        }, 2000);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Setup Your Business</h1>
              <p className="text-blue-100 mt-1">
                Answer a few quick questions to get started
              </p>
            </div>
            <Link
              href="/admin"
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
            >
              Skip to Dashboard →
            </Link>
          </div>
        </div>

        <div className="h-96 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-900"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-2xl">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {messages.some(
          (m) => m.role === "assistant" && m.content.includes("Setup complete")
        ) && (
          <div className="p-6 bg-blue-50 border-t border-blue-100">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900 mb-4">
                🎉 Your business is all set up!
              </p>
              <Link
                href="/admin"
                className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition shadow-lg"
              >
                Go to Dashboard →
              </Link>
            </div>
          </div>
        )}

        <div className="border-t p-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && input.trim()) {
                  handleSend();
                }
              }}
              placeholder="Type your answer..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
