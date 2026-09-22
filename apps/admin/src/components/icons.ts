/**
 * The icon set, in one place.
 *
 * The mock-ups are drawn with Phosphor Light (Figma sheet 496:2, «Основи и
 * решения»). Lucide's default 2px stroke makes the same interface read
 * noticeably heavier than the design, so the portal uses Phosphor and sets the
 * weight once, through `IconContext` in main.tsx.
 *
 * Names on the left are the ones the screens use — mostly the Lucide spelling,
 * kept so the call sites read the same as the rest of the product. Where
 * Phosphor has no exact twin the nearest glyph is chosen and noted.
 */
export {
  ArrowLeft,
  ArrowRight,
  ArrowsDownUp as ArrowUpDown,
  Bell,
  Buildings as Building2,
  CalendarBlank as CalendarDays,
  CaretDown as ChevronDown,
  Check,
  CheckCircle as CircleCheck,
  CircleNotch as LoaderCircle,
  Clock,
  DotsThree as MoreHorizontal,
  Envelope as Mail,
  // Phosphor has no envelope-with-plus; the invite action uses a plain one.
  EnvelopeSimple as MailPlus,
  Eye,
  EyeSlash as EyeOff,
  FileArrowUp as FileUp,
  Globe,
  Hammer,
  Info,
  List as Menu,
  Lock,
  MagnifyingGlass as Search,
  Monitor,
  Moon,
  PencilSimple as Pencil,
  Plus,
  Shield,
  ShieldCheck,
  ShieldSlash as ShieldOff,
  SignOut as LogOut,
  SlidersHorizontal,
  Sparkle as Sparkles,
  SquaresFour as LayoutGrid,
  Sun,
  Trash as Trash2,
  ArrowCounterClockwise as RotateCcw,
  ArrowsClockwise as RefreshCw,
  UserGear as UserCog,
  UserMinus as UserX,
  Users,
  Wallet,
  Warning as TriangleAlert,
  WarningCircle as CircleAlert,
  X,
} from '@phosphor-icons/react';

export type { Icon } from '@phosphor-icons/react';
