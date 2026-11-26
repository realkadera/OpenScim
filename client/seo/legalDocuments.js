// The site's legal pages: what each says, and the texts search engines are
// given of it (routes.js builds its route). Moved as it was out of
// assets/application.js, which draws the links to them.
import { siteName } from "./site.js";

const contactEmail = "privacy@openscim.dev";
// The day the documents were last changed (the page's structured data).
export const legalDocumentsDate = "2026-11-03";
export const legalDocuments = [
  {
    id: "disclaimer",
    routePath: "/disclaimer",
    navLabel: "Disclaimer",
    title: "Disclaimer",
    metaTitle: "Disclaimer | OpenScim.dev",
    metaDescription:
      "OpenScim.dev is an unofficial Old School RuneScape fan project. It is not affiliated with, endorsed by, or sponsored by Jagex, and its simulation is not guaranteed accurate.",
    keywords: [
      "OpenScim.dev disclaimer",
      "unofficial OSRS",
      "not affiliated with Jagex",
      "fan project",
    ],
    summary:
      "OpenScim.dev is an unofficial fan project built by players. It is not the game, it does not speak for the game, and it can be wrong.",
    sections: [
      {
        id: "unofficial",
        heading: "Unofficial and unaffiliated",
        blocks: [
          {
            kind: "paragraph",
            text:
              siteName +
              " is an independent, community-made project. It is not affiliated with, associated with, authorized by, endorsed by, or in any way officially connected with Jagex Limited, Old School RuneScape, or RuneScape.",
          },
          {
            kind: "paragraph",
            text: "Nothing on this site is an official statement about the game. If this site and the live game disagree, the live game is right and this site is wrong.",
          },
          {
            kind: "paragraph",
            text: "The site is not a game client. It does not connect to the game servers, does not log into the game, and cannot affect a RuneScape account in any way. The one thing it does read is the public hiscores: if you ask the loadout planner to fill in your levels, our server looks that name up on Jagex's public hiscores endpoint. That is a public page anyone can read, and it changes nothing about the account.",
          },
        ],
      },
      {
        id: "trademarks-and-assets",
        heading: "Trademarks and game assets",
        blocks: [
          {
            kind: "paragraph",
            text: "Old School RuneScape and RuneScape are trademarks of Jagex Limited. The names, marks, artwork, models, animations, sound, interface sprites, fonts, and other game content reproduced here are the property of Jagex Limited and are used to depict the game the simulator models.",
          },
          {
            kind: "paragraph",
            text: "Using them here is not a claim of ownership and grants you no rights in them. Any other trademarks named on this site belong to their respective owners.",
          },
          {
            kind: "paragraph",
            text:
              "Jagex has not reviewed this project. If Jagex would like anything here changed or taken down, write to " +
              contactEmail +
              " and we will act on it.",
          },
        ],
      },
      {
        id: "accuracy",
        heading: "Accuracy is not guaranteed",
        blocks: [
          {
            kind: "paragraph",
            text: "The simulator is reconstructed from observation, packet captures, and open-source client references. It is a model of the game, built by hand, and it is incomplete by definition.",
          },
          {
            kind: "list",
            items: [
              "Timings, damage, mechanics, and behavior here can differ from the live game.",
              "A game update can invalidate any of it without this site changing at all.",
              "Practicing a mechanic here is not a guarantee you will execute it in game.",
              "Nothing here is advice about how to spend your time, your gear, or a hardcore life.",
            ],
          },
          {
            kind: "callout",
            text: "Use it to learn a fight, not to settle an argument about one.",
          },
        ],
      },
      {
        id: "availability-and-liability",
        heading: "Availability and liability",
        blocks: [
          {
            kind: "paragraph",
            text: "The site is provided as it is, without warranties of any kind, express or implied, including any warranty of accuracy, fitness for a particular purpose, or uninterrupted availability. It is free, it is maintained in spare time, and it can break or disappear.",
          },
          {
            kind: "paragraph",
            text: "To the fullest extent the law allows, we are not liable for any loss arising from using this site or relying on anything it shows you.",
          },
        ],
      },
      {
        id: "contact",
        heading: "Contact",
        blocks: [
          {
            kind: "paragraph",
            text:
              "Corrections, rights concerns, and takedown requests go to " +
              contactEmail +
              ".",
          },
        ],
      },
    ],
  },
];
