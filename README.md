# ⏱️ Pro Multi-Timer

### 🔗 [Click here to open the Timer](https://dinglemire.github.io/timer/)

A professional, web-based multi-timer application designed for productivity. It features a dark theme by default, supports multiple groups (tabs) of timers, and saves your settings automatically so you never lose your place.

## ✨ Features

*   **Multiple Tabs:** Organize timers into groups (e.g., "Cooking", "Work", "Workout").
*   **Custom Layouts:** Toggle between **List View** (1 column) and **Grid View** (2 columns) for better visibility.
*   **Persistent Data:** All timers, times, and names are saved to your browser's LocalStorage. They reappear exactly as you left them when you refresh.
*   **Audio Alerts:** Uses the Web Audio API to generate sounds (Beeps, Alarms) without requiring external MP3 downloads.
*   **Background Monitoring:** The browser tab title updates with the shortest remaining time, so you can see the countdown even while browsing other sites.
*   **Themes:**
    *   🌑 Default Dark
    *   🔵 Steam Blue
    *   ⚪ Clean Light
*   **Quick Controls:** Add +1m or +5m with a single click.

## 🚀 How to Use

1.  **Add a Tab:** Click the `+` button next to the tabs to create a new group. Rename it by typing in the input box below.
2.  **Add a Timer:** Click "Add Timer". It defaults to 1 minute.
3.  **Edit Time:** Click the **Edit (Pen icon)** or use the **Quick Buttons (+1m, -1m)** to change the duration.
4.  **Change View:** Click the **View** button in the top header to switch between a vertical list or a side-by-side grid.
5.  **Start:** Press Play. The progress bar will change color from Green to Red as time runs out.

## 🛠️ Installation / Hosting

This project is a static web application (HTML/CSS/JS). You can host it for free on GitHub Pages.

1.  Clone or fork this repository.
2.  Go to **Settings** > **Pages**.
3.  Select `main` branch as the source.
4.  Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## 💻 Tech Stack

*   **HTML5**
*   **CSS3** (Variables for theming, Flexbox/Grid for layout)
*   **Vanilla JavaScript** (No frameworks, lightweight and fast)
*   **Web Audio API** (For sound generation)
*   **FontAwesome** (For icons)

## 📄 License

Free to use for personal or commercial projects.
