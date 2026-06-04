# CEF ↔ Pawn contracts

All public ELITE RUSSIA CEF interfaces follow one rule: the interface should not know server internals, and Pawn should not depend on DOM details.

CEF sends named callbacks. Pawn opens interfaces and sends state updates.

## Opening an interface

Pawn:

```pawn
SendEliteInterfaceOpen(playerid, "Authorization");
```

CEF:

```js
window.EliteInterfaces.open("Authorization");
```

## Closing an interface

Pawn:

```pawn
SendEliteInterfaceClose(playerid, "Authorization");
```

CEF:

```js
window.EliteInterfaces.close("Authorization");
```

## Sending data to CEF

Pawn:

```pawn
SendEliteInterfaceData(playerid, "Hud", "setMoney", "125000");
```

CEF:

```js
window.Hud.setMoney(125000);
```

## Sending callback to Pawn

CEF:

```js
window.EliteBridge.emit("OnAuthorizationSubmit", {
  nickname: "Player_Name",
  password: "hidden"
});
```

Pawn callback:

```pawn
forward OnAuthorizationSubmit(playerid, const nickname[], const password[]);
```

## Skin selector rule

The skin selector must send a real `modelId`, not only a visual slot.

Bad:

```js
sendClientEvent("OnRegistrationSkin", slot);
```

Good:

```js
window.EliteBridge.emit("OnRegistrationSkin", {
  slot: 2,
  modelId: 250
});
```

The visible card, selected state and callback payload must point to the same model.
