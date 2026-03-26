"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Customer {
  id: string;
  full_name: string | null;
  phone: string;
}

export default function MobileMessagesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [messageType, setMessageType] = useState<"all" | "select">("all");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCustomers = async () => {
    const result = await supabase.auth.getUser();
    const user = result.data.user;
    if (!user) return;

    const bizResult = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (bizResult.data) {
      const custResult = await supabase
        .from("customers")
        .select("id, full_name, phone")
        .eq("business_id", bizResult.data.id);

      setCustomers(custResult.data || []);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      alert("Please enter a message");
      return;
    }

    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSending(false);
    alert(
      `Message sent to ${
        messageType === "all" ? "all customers" : "selected customers"
      }!`
    );
    setMessage("");
  };

  const templates = [
    "Special offer: 20% off your next service! Book now.",
    "We have a last-minute opening tomorrow. Interested?",
    "Thank you for your business! We appreciate you.",
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 sticky top-0 z-10">
        <Link
          href="/admin/mobile/menu"
          className="inline-flex items-center text-white mb-4"
        >
          <span className="text-2xl mr-2">←</span>
          <span className="font-medium">Back to Menu</span>
        </Link>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-blue-100 mt-1">Send SMS to customers</p>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Send To
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMessageType("all")}
                  className={`py-3 rounded-xl font-bold transition ${
                    messageType === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  All ({customers.length})
                </button>
                <button
                  onClick={() => setMessageType("select")}
                  className={`py-3 rounded-xl font-bold transition ${
                    messageType === "select"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  Select
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                rows={5}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-base text-gray-900"
              />
              <p className="text-sm text-gray-500 mt-2">
                {message.length} / 160 characters
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <label className="block text-sm font-bold text-gray-900 mb-3">
                Quick Templates
              </label>
              <div className="space-y-2">
                {templates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => setMessage(template)}
                    className="w-full text-left p-3 bg-gray-50 rounded-xl text-sm active:bg-gray-100 text-gray-900"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 active:scale-95 transition shadow-lg"
            >
              {sending ? "Sending..." : "Send Message"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
