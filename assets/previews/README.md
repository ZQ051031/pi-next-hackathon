# Pi Tasks preview images

The [Pi Next page](https://minepi.com/pi-next/) requires preview images showing the app interface. No mandatory pixel dimensions were published on that page or in the [Mainnet Listing Requirements](https://developers.minepi.com/docs/build-first-app/MainnetListing) when checked. Follow the Developer Web Console’s actual upload rules at submission time; the sizes below are recommendations, not official requirements.

| Placeholder filename | Recommended PNG size | Capture |
| --- | --- | --- |
| `board-desktop.png` | 1440 × 900 px | Main board with logo, Demo mode label, Pi rewards, filters and the first row of task cards. |
| `task-mobile.png` | 1080 × 1920 px | Narrow-screen task detail with reward, claim deadline and claim or completion action. |
| `completed-profile.png` | 1440 × 900 px | Contributor profile with claimed work, one paid demo bounty, and the reputation point. |

Run `npm run dev`, use the demo accounts and follow [the demo script](../../DEMO_SCRIPT.md). Capture the task detail in a mobile viewport and export at the recommended resolution or the required Console size. Crop away browser chrome and avoid actual usernames, keys, balances, transaction IDs, or personal content. Use the [SVG wordmark](../../public/logo.svg) for the logo field; if it requires a raster image, export that SVG at the dimensions given by the Console.
