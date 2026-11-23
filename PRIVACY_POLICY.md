# Pi Tasks Privacy Policy

Pi Tasks is an independent demo and Testnet prototype. It is not operated by Pi Network.

## Data and purpose

- **Demo mode:** The app does not request a real account. It uses built-in demo usernames and does not call Pi services.
- **Pi Sandbox:** On sign-in the Pi SDK returns an app-scoped identifier, a username, and an access token. Pi Tasks uses the identifier and username to attribute tasks and show profiles. To verify payments, the app sends the token to the optional payment server, which uses it to check your identity with Pi. The app keeps the token in memory, not in browser storage.
- **Board data:** Task titles, descriptions, claim deadlines, categories, reward amounts, submissions, user handles and payment receipt IDs are saved in the current browser to display the board and its history. There is no shared database. Other people who can use the same browser profile may be able to read these records. Do not post personal contact details, wallet credentials, private links, or sensitive information.
- **Testnet payments:** The optional backend sends authorization credentials, payment identifiers and transaction IDs to Pi for verification. Task IDs, transaction amounts and a short memo are supplied to Pi for the payment flow. Pi processes this data under [its own privacy policy](https://socialchain.app/privacy), and blockchain records cannot be erased by Pi Tasks.

## Retention and choices

Clear site data in your browser to remove the local board. Signing out clears the active app session but not task history. Choosing Demo mode avoids contacting Pi through this app; you may revoke Pi permissions through Pi’s account controls where available. Pi Tasks does not implement advertising or analytics, sell personal data, or ask for email, phone number, or wallet passphrase. The hosting provider may keep normal request logs; the operator should document any additional collection before publishing.

For questions about this prototype, contact the maintainer through the [Pi Tasks repository](https://github.com/ZQ051031/pi-next-hackathon). Do not include credentials or private task details in a public issue.
