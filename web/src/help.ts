// The help inside the app. Plain words, what to press, and what happens. Each article has an id so a screen can link
// straight to it (#help/<id>). The same answers are in the README, which is what gobeyond.nz/gateway and Atlas read,
// so a change here belongs there too.

export type Article = {
  id: string
  title: string
  /** Extra words people might search with. */
  words: string
  /** Paragraphs. **Bold** marks what to press. Lines starting with "- " are a list. */
  body: string[]
}

export type Topic = { title: string; articles: Article[] }

export const HELP: Topic[] = [
  {
    title: "Getting going",
    articles: [
      {
        id: "setup",
        title: "Setting it up",
        words: "start first time install plug in fibre box ont beyond setup",
        body: [
          "Plug the cable from the fibre box on the wall (the ONT) into Beyond's **WAN** port, and plug the power in.",
          "On your phone, join the Wi-Fi called **Beyond Setup**, then open **beyond.lan** in the browser.",
          "Beyond finds your internet by itself. Then you pick a Wi-Fi name and password, and a password for the router. About three minutes all up.",
        ],
      },
      {
        id: "old-wifi",
        title: "Keep your old Wi-Fi name",
        words: "same name ssid rejoin devices reconnect",
        body: [
          "Give Beyond the same Wi-Fi name and password your old router had, capitals and all. Every phone, TV and speaker in the house then joins by itself, as if nothing changed.",
          "Your old router's name and password are usually on a sticker underneath it.",
        ],
      },
      {
        id: "which-isp",
        title: "Does it work with my internet?",
        words: "isp spark one nz vodafone 2degrees skinny orcon slingshot contact hyperfibre vlan 10 pppoe",
        body: [
          "Yes, with fibre from any New Zealand provider: One NZ, Spark, 2degrees, Skinny, Orcon, Slingshot, Contact, Now and the rest. Beyond works out how your provider connects (most use something called VLAN 10) so you never have to type it.",
          "On Hyperfibre, the faster-than-gigabit plans, plug the fibre box into the **2.5 Gb** port, which is the WAN port on every router we support.",
          "On copper (VDSL), 4G or 5G, keep your provider's modem as the modem and plug Beyond into one of its ports. Beyond works behind it.",
        ],
      },
      {
        id: "phone",
        title: "A home phone through the modem",
        words: "landline voip voice calls phone handset",
        body: [
          "If your home phone plugs into your provider's modem, keep that modem. Plug it into one of Beyond's ports, just for the phone. Your calls carry on as before.",
          "Or ask your provider about their calling app, and you can put the modem away.",
        ],
      },
    ],
  },
  {
    title: "Every day",
    articles: [
      {
        id: "pause",
        title: "Pausing a device",
        words: "pause internet kids bedtime block stop turn off",
        body: [
          "In **Devices**, flick the switch beside a device to pause its internet. Flick it back to let it online again.",
          "A paused device stays on the Wi-Fi, so it comes straight back when you un-pause it. It just can't reach the internet.",
          "Coming soon: a Wi-Fi password for each person, so a pause follows their phone even if they change its settings.",
        ],
      },
      {
        id: "names",
        title: "Naming a device",
        words: "rename name what is this unknown device",
        body: [
          "In **Devices**, tap a device and give it a name and a kind (phone, TV, laptop). Names stay on the router, so everyone who signs in sees them.",
          "Don't recognise one? Tap it to see when it first joined. If you'd rather it wasn't there, pause it, then change the Wi-Fi password (it stays out until someone gives it the new one).",
        ],
      },
      {
        id: "wifi",
        title: "Changing the Wi-Fi name or password",
        words: "wifi password ssid change network name",
        body: [
          "Open **Wi-Fi**, type the new name or password and press **Save**.",
          "Everything in the house drops off for a moment. Devices that know the new password join again by themselves. Anything else needs the new password typed in.",
        ],
      },
      {
        id: "wifi-qr",
        title: "Joining with a QR code",
        words: "qr code join guest visitor share password print card fridge camera scan",
        body: [
          "Open **Wi-Fi** and tap **Show the code**. Anyone pointing an iPhone or Android camera at it gets a **Join** button, with no password to type.",
          "**Print a card for the fridge** prints the code with the name and password on one page. Anyone who can see the card can join, so put it where you'd be happy for visitors to see it.",
          "Changed the password? The code changes with it. Print a new card and throw the old one out, because it won't work any more.",
        ],
      },
      {
        id: "mesh",
        title: "More Wi-Fi around the house (mesh)",
        words: "mesh point second router extender upstairs garage sleepout weak signal coverage roaming add another router",
        body: [
          "One Beyond router is the **main** one, plugged into the fibre box. Any other router running Beyond Gateway, whatever the make, can join it as a **mesh point**. Every point puts out the same Wi-Fi name and password, so phones move to the nearest one by themselves.",
          "To add one: put Beyond Gateway on the other router and turn it on without setting it up. Run a cable from its **WAN** port to one of the main router's ports (wall sockets or a powerline adapter are fine). Join its **Beyond Setup** Wi-Fi, open **beyond.lan**, choose **Add to my Beyond network** and type the main router's password.",
          "About two minutes later it's putting out your Wi-Fi, and it shows under **Settings**, **Mesh points** on the main router. Give it a name like **Upstairs**, and **Devices** then says which router each phone is on.",
          "Changing the Wi-Fi name or password on the main router changes it on every point within a minute. Pausing a device works wherever it is in the house.",
          "Points need a cable back to the main router for now. Joining over Wi-Fi alone is coming.",
          "To take one off: **Settings**, **Mesh points**, **Change**, **Take it off the mesh**. Then reset the point (hold its reset button for 10 seconds) to use it as a router of its own again.",
        ],
      },
      {
        id: "slow",
        title: "The internet is slow",
        words: "slow speed lag buffering",
        body: [
          "**Home** shows how much is being used right now. A big number means something in the house is downloading, often a game console or a computer update.",
          "Far from the router? Walls and floors slow Wi-Fi down. Try the same thing near the router. If it's quick there, add a second Beyond router as a mesh point further away (see **More Wi-Fi around the house**).",
        ],
      },
    ],
  },
  {
    title: "When something's wrong",
    articles: [
      {
        id: "no-internet",
        title: "The internet isn't working",
        words: "no internet offline down not working broken red",
        body: [
          "Check the fibre box on the wall: the light marked **PON** or **Optical** should be steady green. If it's red or off, the problem is outside the house. Ring your provider.",
          "Check the cable from the fibre box goes into Beyond's **WAN** port.",
          "In **Settings**, press **Find the internet again**. Beyond tries every way New Zealand providers connect, which takes about a minute.",
          "Still nothing? Press **Restart** in **Settings**, or turn Beyond off and on at the wall.",
        ],
      },
      {
        id: "forgot-password",
        title: "Forgot the router password",
        words: "password forgot locked out reset sign in",
        body: [
          "Hold the **reset** button on the router for 10 seconds, then let go. It restarts as new, with the **Beyond Setup** Wi-Fi, in about three minutes.",
          "Set it up again with your usual Wi-Fi name and password and everything rejoins. Device names and pauses start fresh.",
        ],
      },
      {
        id: "restart",
        title: "Restarting the router",
        words: "restart reboot turn off on",
        body: ["In **Settings**, press **Restart**. The internet is off for about a minute, for everyone in the house. Turning it off and on at the wall does the same."],
      },
    ],
  },
  {
    title: "Updates and your router",
    articles: [
      {
        id: "updates",
        title: "Updates",
        words: "update new version upgrade automatic overnight firmware",
        body: [
          "Beyond checks for a new version each night. When there is one, **Settings** says **Update ready**, and one press installs it. The internet is off for about three minutes while it does.",
          "Turn on **Install updates by themselves** and it installs new versions overnight instead, while everyone's asleep.",
          "Every setting stays: your Wi-Fi, the router password, device names and pauses. Beyond only installs a version that Beyond has signed, so nobody else can send your router an update.",
        ],
      },
      {
        id: "family",
        title: "Seeing your router from Beyond Family",
        words: "beyond family away remote phone app link code home network see from work",
        body: [
          "Link the router to Beyond Family and a grown-up in your household can see, from anywhere, whether the internet's working at home, how fast it's going and which devices are online. Your Beyond TVs show alongside.",
          "In **Settings**, tap **Connect to Beyond Family**. The router shows a six letter code. In the Beyond Family app, open **Family**, then **Home network**, and type it. It links within a few seconds.",
          "It's look only: nothing in Beyond Family can change your router. Each minute the router sends the names you gave your devices and whether each is online, never their addresses, your Wi-Fi password or what anyone does online.",
          "To stop, tap **Unlink** here or in Beyond Family. Either one ends it straight away.",
        ],
      },
      {
        id: "way-back",
        title: "Going back to your old router",
        words: "undo old router go back remove uninstall original",
        body: [
          "Unplug the cable from Beyond's **WAN** port and plug it into your old router instead. That's all. Nothing about your internet plan changed.",
          "To put the router's own software back, follow its maker's recovery steps. On GL.iNet routers, hold the reset button while plugging the power in, then open 192.168.1.1.",
        ],
      },
      {
        id: "advanced",
        title: "Advanced settings",
        words: "luci openwrt advanced port forwarding dns static ip expert",
        body: [
          "For people who know networks: **Advanced settings** in **Settings** opens OpenWrt's own screens, with every setting there is. Beyond is OpenWrt underneath.",
          "Changes made there can confuse the Beyond app, so change only what you understand.",
        ],
      },
      {
        id: "privacy",
        title: "Privacy",
        words: "privacy data tracking what does it send",
        body: [
          "What happens in your house stays on your router: your devices, their names and what they do are never sent to Beyond, unless you link the router to Beyond Family.",
          "If you do, it sends the names you gave your devices and whether each is online, once a minute, only to your own household. Never their addresses or what anyone does online. Unlink and it stops.",
          "Once a night the router asks GitHub, where Beyond's releases live, whether there's a new version. That's all it sends.",
        ],
      },
    ],
  },
]

export const ARTICLES = HELP.flatMap((t) => t.articles)

export const SUPPORT_URL = "https://gobeyond.nz/gateway#support"

/** Articles matching what someone typed: every word has to appear in the title, the search words or the text. */
export function searchHelp(query: string): Article[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return ARTICLES
  return ARTICLES.filter((a) => {
    const hay = `${a.title} ${a.words} ${a.body.join(" ")}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
