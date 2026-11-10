// Times every wallpaper inside real WebKit (the engine the app uses), so a
// heavy scene shows up before it reaches anyone's battery.
// usage: xcrun swift scripts/bench.swift [wallpaper ...]
import AppKit
import WebKit

let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("Wallpapers")
let names = CommandLine.arguments.dropFirst().isEmpty ? ["torii", "koi", "fuji", "kaze", "take", "sakura", "yuki", "hotaru", "tsuki", "nami", "momiji", "hoshi", "toro", "unkai", "tsuru", "neko", "hanabi", "shoji", "hasu", "kiri", "densha", "kurage", "suisha", "yokocho", "ajisai", "tanada", "shika", "fukuro", "usagi", "nagisa", "isaribi", "taki", "kazan", "onsen", "tsuyu", "kaki", "kamo", "himawari", "shiro", "icho", "tako", "koinobori", "furin", "kingyo", "chawan", "jihanki", "kintsugi", "tombo", "kaeru", "komorebi", "suzume", "tanuki", "kitsune", "iruka", "kujira", "umigame", "sango", "todai", "minato", "hashi", "gojunoto", "yamadera", "kane", "koke", "shishi", "bonsai", "ikebana", "maneki", "orizuru", "yatai", "kotatsu", "kissaten", "fumikiri", "basutei", "yakei", "kasa", "matsuri", "uma", "hakucho", "sagi", "tsubame", "ume", "tsubaki", "ayame", "higan", "fujidana", "matsu", "kakashi", "kamakura", "tsurara", "ryuhyo", "tanabata", "niji", "meoto", "sakyu", "kabuto", "jizo", "enso", "asanoha", "konbini", "kinkaku", "itsukushima", "inari", "shinkansen", "sento", "ramen", "chochin", "karesansui", "kodo", "hanaikada", "nanohana", "susuki", "juhyo", "shirakawa", "kiyomizu", "tawa", "kosaten", "izakaya", "sakagura", "kadomatsu", "hatsuhinode", "sansui", "byobu", "aizome", "saru", "cho", "medaka", "kani", "inoshishi", "mejiro", "kawasemi", "yudachi", "oboro", "kogarashi", "karasu", "danchi", "kanransha", "sakamichi", "inaho", "chabatake", "uzushio", "ryusei", "teruteru", "temari", "koma", "sensu", "irori", "andon", "tsukubai", "shodo", "engawa", "mikan", "ginkaku", "matsumoto", "todaiji", "nikko", "kegon", "kenrokuen", "togetsukyo", "kintaikyo", "yakushima", "kamikochi", "ashinoko", "shuri", "ishigaki", "asakusa", "yukimatsuri", "otaru", "takayama", "kurashiki", "kawagoe", "tsumago", "ginzan", "gion", "kotohira", "nachi", "aso", "sakurajima", "oirase", "nemophila", "furano", "kazurabashi", "ropeway", "hatsuyuki", "tsuyukusa", "kinmokusei", "sazanka", "nadeshiko", "kikyo", "hagi", "suisen", "yamabuki", "fuyubotan", "tsutsuji", "asagao", "shigure", "nyudogumo", "yuyake", "akatsuki", "shimobashira", "tsuyuake", "kitsutsuki", "hibari", "uguisu", "semi", "takotsubo", "ayu", "umineko", "washi", "kamoshika", "risu", "suzumushi", "oshidori", "momonga", "kiji", "tokonoma", "furoshiki", "kokeshi", "hinadan", "koto", "nabe", "wagashi", "tokkuri", "shippo", "uroko", "kikko", "kasuri", "ichimatsu", "dojo", "kyoshitsu", "minka", "shotengai", "hiraizumi", "izumo", "yoshino", "daibutsu", "rishiri", "yukinootani", "hanamizuki", "kohan", "kasumi", "chinden", "kakigori", "enoshima", "tsuwano", "kushiro", "aoiike", "nohbutai", "komainu", "emaki", "senko", "hikokigumo", "taue", "himeji", "shirakami", "ouchijuku", "inuyama", "hakone", "ine", "amanohashidate", "hirosaki", "matsushima", "akiyoshi", "hakuba", "biwako", "shimanami", "sado", "tsunoshima", "chureito", "onomichi", "tomonoura", "tokyo", "osaka", "biei", "bandai", "shirakaba", "miho", "hokusai", "bokashi", "yuzen", "sashiko", "kumiko", "kamifusen", "kamisuki", "urushi", "kiriko", "noren", "tatami", "fusuma", "kama", "mokuhan", "ranma", "mizuhiki", "yukata", "tenugui", "shoin", "kamon", "yagasuri", "tsuboniwa", "harusame", "natsuyasumi", "akikusa", "yukiakari", "haruichiban", "mangetsu", "obon", "hatsumode", "kagero", "nowaki", "tsukiyo", "asagiri", "tasogare", "sakurafubuki", "shiosai", "aozora", "kirisame", "ryokan", "eki", "ishidoro", "chashitsu", "toge", "kawara", "kusaridoi", "yukimi", "hanami", "sudare", "seto", "daimonji", "nebuta", "imari", "oribe", "satoyama", "hamabe", "changcheng", "gugong", "xihu", "guilin", "huangshan", "zhangjiajie", "lijiang", "sanxia", "jiuzhaigou", "suzhou", "longji", "yuanyang", "dunhuang", "shamo", "pingyao", "hongcun", "wuzhen", "tulou", "shanghai", "hukou", "taishan", "emeishan", "shilin", "chengqiang", "yihe", "tiantan", "lugou", "wuyi", "shuimo", "gongbi", "qinghua", "qingci", "jingtailan", "diaoqi", "jianzhi", "piying", "fengzheng", "denglong", "sichou", "yunjin", "suxiu", "zhuanke", "tuanshan", "chuanghua", "yuemen", "wajian", "qingtong", "yubi", "yantai", "bimo", "gongfucha", "zisha", "chunjie", "yuanxiao", "qingming", "longzhou", "zhongqiu", "chongyang", "dongzhi", "niulang", "helian", "meihua", "mudan", "zhulin", "songshi", "xiongmao", "yunlong", "fenghuang", "xiangyun", "jiangnan", "chayuan", "baota", "yuhuo", "fengqiao", "xuezhong", "hanshan", "taiji", "kongming", "shuiyue", "chaguan"] : Array(CommandLine.arguments.dropFirst())

@MainActor
func bench(_ name: String) async -> String {
    let config = WKWebViewConfiguration()
    config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
    let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 1512, height: 982), configuration: config)
    let start = Date()
    view.loadFileURL(root.appendingPathComponent("\(name)/index.html"), allowingReadAccessTo: root)
    for _ in 0..<100 {
        try? await Task.sleep(for: .milliseconds(50))
        if (try? await view.evaluateJavaScript("!!window.tokonoma")) as? Bool == true { break }
    }
    let boot = Date().timeIntervalSince(start)
    let script = """
    window.tokonoma.setPaused(true);
    const blocks = [];
    for (let k = 0; k < 4; k++) {
      const t0 = performance.now();
      window.tokonoma.step(1 / 30, 90);
      blocks.push((performance.now() - t0) / 90);
    }
    return blocks;
    """
    let result = try? await view.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page)
    let blocks = (result as? [Double]) ?? []
    let worst = blocks.max() ?? .nan
    let mean = blocks.isEmpty ? .nan : blocks.reduce(0, +) / Double(blocks.count)
    return String(format: "%-6@ boot %5.0f ms   mean %5.2f ms/frame   worst block %5.2f ms/frame", name as NSString, boot * 1000, mean, worst)
}

let app = NSApplication.shared
Task { @MainActor in
    for name in names { print(await bench(name)) }
    exit(0)
}
app.run()
