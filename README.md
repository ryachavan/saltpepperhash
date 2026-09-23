# Password Hashing Techniques

An educational Node.js application that demonstrates three password-protection approaches:

1. Plain hashing
2. Salted hashing
3. Salted and peppered hashing

The app lets someone register an account, log in, and inspect what happens during password hashing and verification.

> This project is for learning. It uses fast SHA-256 and an intentionally tiny pepper search space. Do not use this implementation for real user accounts.

## How the pieces fit together

```text
Browser pages in public/
        |
        | HTTP requests such as POST /api/register
        v
server.js (Express routes and sessions)
        |
        | calls hashing functions
        v
utils/hashing.js (salt, pepper, and SHA-256)
        |
        | returns hash results
        v
server.js
        |
        | SQL queries through better-sqlite3
        v
db.js -> database.db (SQLite)
```

The browser never talks directly to SQLite. The browser talks to `server.js`, and `server.js` is responsible for calling the hashing helper and database.

## Main files

| File | Responsibility |
| --- | --- |
| `public/index.html` | Home page and explanation |
| `public/register.html` | Registration form and method selection |
| `public/login.html` | Login form |
| `public/dashboard.html` | Displays the stored hash, salt, and verification details |
| `public/style.css` | Shared frontend styling |
| `server.js` | Express server, API routes, sessions, and request coordination |
| `utils/hashing.js` | Generates salts, peppers, hashes, and verification attempts |
| `db.js` | Opens SQLite and creates the `users` table |
| `database.db` | Local SQLite database; ignored by Git |
| `.env` | Local secrets and configuration; ignored by Git |
| `.env.example` | Safe configuration template |

## Setup

Requirements:

- Node.js 22 or newer
- npm

Install dependencies:

```bash
npm install
```

Create a local `.env` file based on `.env.example`:

```env
NODE_ENV=development
PORT=3000
SESSION_SECRET=replace-this-with-a-long-random-value
DATABASE_PATH=./database.db
```

Start the server:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

`SESSION_SECRET` signs login session cookies. It is not a password hash and should never be committed to GitHub.

## Registration process

The registration page sends the selected username, password, and method to the server:

```text
POST /api/register
```

Example request:

```json
{
  "username": "alex",
  "password": "coffee123",
  "method": "salted"
}
```

`server.js` validates the request, checks whether the username already exists, and then calls the appropriate function in `utils/hashing.js`.

### Method 1: plain hashing

```javascript
hash = sha256(password);
```

Conceptually:

```text
SHA-256("coffee123") -> stored hash
```

Nothing random is added. Two users with the same password receive the same hash.

### Method 2: salted hashing

First, `randomSalt()` creates a random value using Node's cryptographic random generator:

```javascript
const salt = randomSalt();
const hash = sha256(password + salt);
```

Example using made-up values:

```text
password = "coffee123"
salt     = "a1f09c22d4e8b701"
input    = "coffee123a1f09c22d4e8b701"
hash     = SHA-256(input)
```

The database stores both the hash and salt:

```text
username | method | hash       | salt
alex     | salted | 8f3...     | a1f...
```

The salt is not a secret. Its purpose is to make each password hash unique and to defeat precomputed rainbow tables.

### Method 3: salted and peppered hashing

The server creates both a salt and a pepper:

```javascript
const salt = randomSalt();
const pepper = randomPepper();
const hash = sha256(password + salt + pepper);
```

In this demo, the pepper is one lowercase letter. Example:

```text
password = "coffee123"
salt     = "a1f09c22d4e8b701"
pepper   = "e"
input    = "coffee123a1f09c22d4e8b701e"
hash     = SHA-256(input)
```

The database stores the salt and hash, but not the pepper:

```text
username | method          | hash       | salt
alex     | salted_peppered | 4b2...     | a1f...
```

The demo briefly returns the pepper in the registration response so it can be displayed for teaching. It is not written to SQLite.

## What gets stored in SQLite

`db.js` creates this table:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  method TEXT NOT NULL,
  hash TEXT NOT NULL,
  salt TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

For a salted account, a row might look like this conceptually:

```text
username: alex
method: salted
hash: 9d7...
salt: 6b2...
created_at: 2026-09-23 12:00:00
```

The original password is never stored.

## Login process

The login page sends:

```text
POST /api/login
```

Example:

```json
{
  "username": "alex",
  "password": "coffee123"
}
```

`server.js` then:

1. Finds the user with a SQL `SELECT` query.
2. Reads the stored method, hash, and salt.
3. Calls the matching verification function.
4. Compares the newly computed hash with the stored hash.
5. Creates a session if they match.

For salted hashing, verification repeats the same calculation:

```text
SHA-256(submitted password + stored salt) == stored hash
```

For the peppered demo, the server tries each possible pepper:

```text
SHA-256(password + salt + "a")
SHA-256(password + salt + "b")
SHA-256(password + salt + "c")
...
```

It stops when one result matches the stored hash. The attempts are saved temporarily in the session so the dashboard can display them.

## Dashboard process

After a successful login, `dashboard.html` requests:

```text
GET /api/session
```

`server.js` checks the session, queries SQLite, and returns JSON containing the account's method, hash, salt, creation time, and recent verification details. The dashboard JavaScript turns that JSON into the visible page.

## Security limitations

This project intentionally simplifies several ideas:

- SHA-256 is fast and is not recommended for production password storage.
- Real applications should use Argon2id, bcrypt, or scrypt.
- The pepper is only one lowercase letter, so it is easy to brute-force.
- The plain hashing option is included only for comparison and should not protect real passwords.
