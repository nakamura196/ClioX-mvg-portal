# What is kept where (on the chain and off it)

When you register a record in Clio-X, what gets kept ends up in two places.
One is the blockchain (Sepolia, for the trial). This is called **on-chain**.
The other is servers outside the chain, called **off-chain**.

The short version:
the chain holds the record of who registered what, when, and who used it, plus the descriptive record.
**The content itself, the text and images, is not on the chain.**

## On the chain

Anything written to the chain can be read by anyone, and it cannot be deleted.
To correct something, you add a new record on top. The old one stays as history.

- **The registration** (data NFT) and the wallet address that owns it. One is created per record
- **The access token** (datatoken) and whether access is free or paid
- **The descriptive record** (DDO): title, description, creator, licence, the address of the service that hands out the files, and so on.
  It can be written encrypted or in the clear
- **A fingerprint of the descriptive record** (a hash), which shows it has not been altered since
- **The address of the node that can open the descriptive record.** An encrypted record can only be opened by the node that registered it
- **Usage records**: who used an access token, and when
- **Lists of who may use a record**, if institutions choose to share such a list on-chain

## Off the chain

- **The content** (text, images). It lives on an institution's server, or in a file store such as IPFS or Arweave.
  The descriptive record says where, but usually in encrypted form that only the node can read
- **The node's key**, kept on the node's server.
  Lose it, and encrypted descriptive records and file locations can no longer be opened
  (see [When the publishing service closes](./when-a-node-closes))
- **The search index**: a copy the node builds by reading the chain. It can be rebuilt from the chain if lost
- **Running analyses and their results**, which happen on the node. The chain only records that access was used
- **The portal (the website)**. It reads and displays the records above; it holds no master copy

IPFS sounds similar but is not a blockchain.
It is a way of storing files in which the address is derived from the content.
If nobody keeps a copy, the file can no longer be retrieved.

## A real example: Kōi Genji monogatari

The trial site lists the 54 chapters of the _Kōi Genji monogatari_ (a collated edition of _The Tale of Genji_).
They were registered as an experiment that uses only the on-chain part of Ocean.

- The descriptive records are written to the chain **unencrypted**.
  For chapter 53 (_Tenarai_), the whole record can be read in the transaction of 27 August 2026,
  [0x17a6…0840](https://sepolia.etherscan.io/tx/0x17a60b8e1086d707734d077edc62d6d7eb3dbf884f3d3e38dae73b9527670840)
- Where the file-serving address would go, they give the IPFS address of the text (`ipfs://…`) instead
- The text is on IPFS, kept by a storage service called Filebase

So anyone can reach the text from the chain alone, without any node.
In exchange, the portal cannot download these records or run analyses on them,
because it expects files to be handed out by a node.
The record's page on the portal says so and links to the text.

## Points for archivists

- **If the descriptive record is written unencrypted, keep personal or restricted information out of it.**
  Nothing written to the chain can be removed
- If it is encrypted, **keeping the node's key safe** is what keeps the record readable
- The content needs its own preservation arrangements. The chain does not store it
