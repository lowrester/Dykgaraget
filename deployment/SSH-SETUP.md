# 🔐 SSH-inställningar för Privat Repository

För att kunna hämta kod från ett privat repository utan att behöva skriva in lösenord varje gång måste servern ha en SSH-nyckel som är kopplad till ditt GitHub-konto.

## 1. Skapa en SSH-nyckel på servern
Logga in på din server via SSH och kör:

```bash
# Skapa nyckeln (tryck Enter för alla frågor — lämna passphrase tomt)
ssh-keygen -t ed25519 -C "server@dykgaraget"

# Starta ssh-agent och lägg till nyckeln
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

## 2. Hämta den publika nyckeln
Visa nyckeln i terminalen och kopiera hela raden:

```bash
cat ~/.ssh/id_ed25519.pub
```

## 3. Lägg till nyckeln på GitHub
1. Gå till ditt repository på GitHub.
2. Gå till **Settings** → **Deploy keys**.
3. Klicka på **Add deploy key**.
4. Ge den ett namn (t.ex. "Proxmox Server") och klistra in nyckeln.
5. Se till att **Allow write access** *inte* är markerat (behövs ej).
6. Klicka på **Add key**.

## 4. Testa anslutningen
Kör detta på servern för att verifiera:

```bash
ssh -T git@github.com
```
*Svara "yes" om du får en fråga om autenticitet.*

## 5. Uppdatera projektet
Nu kan du köra `update.sh`. Skriptet kommer automatiskt upptäcka att du vill köra via SSH och konfigurera om Git-remoten åt dig.

```bash
sudo ./deployment/update.sh
```
