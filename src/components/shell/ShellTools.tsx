import { ThemeToggle } from "@/components/theme/ThemeToggle";

/** 登入後各區（品牌、創作者、管理後台）桌面版右上角的工具列：目前只有主題切換。手機版在 MobileTopBar 裡。 */
export function ShellTools() {
  return (
    <div className="mx-auto hidden h-11 max-w-[1120px] items-center justify-end md:flex">
      <ThemeToggle />
    </div>
  );
}
