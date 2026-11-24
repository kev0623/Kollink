"use client";
import { Compass, FileText, Handshake, MessageCircle, Receipt, Settings, Sparkles, UserRound, Wallet } from "lucide-react";
import type { NavIconName } from "./nav";

const ICONS = { Compass, FileText, Handshake, MessageCircle, Receipt, Settings, Sparkles, UserRound, Wallet };

export function NavIcon({ name, size }: { name: NavIconName; size: number }) {
  const Icon = ICONS[name];
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
