import { spawnSync } from "node:child_process";

const url = process.argv.find((arg) => arg.startsWith("https://"));
const errorStage = process.argv.includes("--error")
  ? process.argv[process.argv.indexOf("--error") + 1]
  : "";
const noOpen = process.env.CIM_NO_OPEN === "1";

const errors = {
  bridge: "WorkBuddy 桥没能启动，请查看「WorkBuddy桥 8790」窗口里的报错。",
  site: "网站没能启动，请查看「校园问答网站 3000」窗口里的报错。",
  cloudflared: "没有找到 cloudflared，请先安装 Cloudflare Tunnel。",
};
const out = (text = "") => process.stdout.write(text + "\n");

out("");
out("  ==========================================");
if (url) {
  out("   全部启动完成！");
  out("");
  out("   本机访问：http://127.0.0.1:3000");
  out(`   公网地址：${url}`);
  out("");
  out("   已在浏览器打开本机地址，公网地址已复制到剪贴板。");
  out("   公网地址发给别人即可。");
  out("   隧道刚启动或正在重连时，公网地址可能要等 1-2 分钟才能打开；");
  out("   本机打不开公网地址也可能是 DNS 缓存，用本机地址访问不受影响。");
  spawnSync("clip", [], { input: url, windowsHide: true });
  if (!noOpen) {
    spawnSync(
      "rundll32.exe",
      ["url.dll,FileProtocolHandler", "http://127.0.0.1:3000"],
      { windowsHide: true },
    );
  }
} else if (errorStage) {
  out(`   启动失败：${errors[errorStage] ?? "请查看对应的黑色窗口。"}`);
} else {
  out("   桥和网站已启动，但没拿到可用的公网地址。");
  out("   请查看「Cloudflare Tunnel」窗口中是否有报错，");
  out("   或查看项目目录下的 tunnel.log 最后几行。");
}
out("  ==========================================");
out("");
out("   关闭本窗口不会停止网站。");
out("   要停止网站，请关闭另外三个窗口（桥、网站、隧道）。");
out("");
