"use client";
import {
  Banknote, Compass, FileText, Handshake, LayoutDashboard, MessageCircle, Receipt, Settings, ShieldAlert, Sparkles,
  UserCheck, UserRound, Wallet,
} from "lucide-react";
import type { NavIconName } from "./nav";

const ICONS = {
  Banknote, Compass, FileText, Handshake, LayoutDashboard, MessageCircle, Receipt, Settings, ShieldAlert, Sparkles,
  UserCheck, UserRound, Wallet,
};

export function NavIcon({ name, size }: { name: NavIconName; size: number }) {
  const Icon = ICONS[name];
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />;
}
