#include <a_samp>
#include "elite_interfaces.inc"

public OnPlayerConnect(playerid)
{
    SendEliteInterfaceOpen(playerid, "Authorization");
    return 1;
}

forward OnAuthorizationSubmit(playerid, const payload[]);
public OnAuthorizationSubmit(playerid, const payload[])
{
    printf("[Auth] player=%d payload=%s", playerid, payload);
    return 1;
}

forward OnRegistrationSkin(playerid, const payload[]);
public OnRegistrationSkin(playerid, const payload[])
{
    // Payload should contain slot and modelId.
    printf("[Skins] player=%d payload=%s", playerid, payload);
    return 1;
}
