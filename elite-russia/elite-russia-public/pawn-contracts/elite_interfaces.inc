#if defined _elite_interfaces_included
    #endinput
#endif
#define _elite_interfaces_included

stock SendEliteInterfaceOpen(playerid, const interfaceName[])
{
    // Replace this body with the real CEF call used by the server.
    printf("[EliteInterfaces] open %d -> %s", playerid, interfaceName);
    return 1;
}

stock SendEliteInterfaceClose(playerid, const interfaceName[])
{
    printf("[EliteInterfaces] close %d -> %s", playerid, interfaceName);
    return 1;
}

stock SendEliteInterfaceData(playerid, const interfaceName[], const methodName[], const payload[])
{
    printf("[EliteInterfaces] data %d -> %s.%s(%s)", playerid, interfaceName, methodName, payload);
    return 1;
}
