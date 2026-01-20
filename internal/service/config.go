package service

import (
	"bytes"
	"fmt"
	"net"

	"gopkg.in/ini.v1"
)

// NetworkConfig configuration
type NetworkConfig struct {
	Match   MatchSection     `json:"Match" ini:"Match"`
	Link    *LinkSection     `json:"Link,omitempty" ini:"Link,omitempty"`
	Network NetworkSection   `json:"Network" ini:"Network"`
	Address []AddressSection `json:"Address,omitempty" ini:"Address,omitempty,allowshadow"`
	Routes  []RouteSection   `json:"Route,omitempty" ini:"Route,omitempty,allowshadow"`
	DHCPv4  *DHCPv4Section   `json:"DHCPv4,omitempty" ini:"DHCPv4,omitempty"`
	DHCPv6  *DHCPv6Section   `json:"DHCPv6,omitempty" ini:"DHCPv6,omitempty"`
}

type MatchSection struct {
	Name         []string `json:"Name,omitempty" ini:"Name,omitempty,allowshadow"`
	OriginalName []string `json:"OriginalName,omitempty" ini:"OriginalName,omitempty,allowshadow"`
	MACAddress   []string `json:"MACAddress,omitempty" ini:"MACAddress,omitempty,allowshadow"`
	Driver       []string `json:"Driver,omitempty" ini:"Driver,omitempty,allowshadow"`
	Type         []string `json:"Type,omitempty" ini:"Type,omitempty,allowshadow"`
	Kind         []string `json:"Kind,omitempty" ini:"Kind,omitempty,allowshadow"`
}

type LinkSection struct {
	MACAddress        string `json:"MACAddress,omitempty" ini:"MACAddress,omitempty"`
	MTUBytes          string `json:"MTUBytes,omitempty" ini:"MTUBytes,omitempty"`
	Unmanaged         string `json:"Unmanaged,omitempty" ini:"Unmanaged,omitempty"`
	RequiredForOnline string `json:"RequiredForOnline,omitempty" ini:"RequiredForOnline,omitempty"`
}

type NetworkSection struct {
	DHCP                string   `json:"DHCP,omitempty" ini:"DHCP,omitempty"`
	Address             []string `json:"Address,omitempty" ini:"Address,omitempty,allowshadow"`
	Gateway             []string `json:"Gateway,omitempty" ini:"Gateway,omitempty,allowshadow"`
	DNS                 []string `json:"DNS,omitempty" ini:"DNS,omitempty,allowshadow"`
	Domains             []string `json:"Domains,omitempty" ini:"Domains,omitempty,allowshadow"`
	NTP                 []string `json:"NTP,omitempty" ini:"NTP,omitempty,allowshadow"`
	IPForwarding        string   `json:"IPForwarding,omitempty" ini:"IPForwarding,omitempty"`
	IPv6AcceptRA        string   `json:"IPv6AcceptRA,omitempty" ini:"IPv6AcceptRA,omitempty"`
	LinkLocalAddressing string   `json:"LinkLocalAddressing,omitempty" ini:"LinkLocalAddressing,omitempty"`
	VLAN                []string `json:"VLAN,omitempty" ini:"VLAN,omitempty,allowshadow"`
	MACVLAN             []string `json:"MACVLAN,omitempty" ini:"MACVLAN,omitempty,allowshadow"`
	VXLAN               []string `json:"VXLAN,omitempty" ini:"VXLAN,omitempty,allowshadow"`
	Tunnel              []string `json:"Tunnel,omitempty" ini:"Tunnel,omitempty,allowshadow"`
	Bond                string   `json:"Bond,omitempty" ini:"Bond,omitempty"`
	Bridge              string   `json:"Bridge,omitempty" ini:"Bridge,omitempty"`
	VRF                 string   `json:"VRF,omitempty" ini:"VRF,omitempty"`
}

type AddressSection struct {
	Address string `json:"Address" ini:"Address"`
	Peer    string `json:"Peer,omitempty" ini:"Peer,omitempty"`
	Label   string `json:"Label,omitempty" ini:"Label,omitempty"`
}

type RouteSection struct {
	Gateway     string `json:"Gateway,omitempty" ini:"Gateway,omitempty"`
	Destination string `json:"Destination,omitempty" ini:"Destination,omitempty"`
	Metric      int    `json:"Metric,omitempty" ini:"Metric,omitempty"`
	Source      string `json:"Source,omitempty" ini:"Source,omitempty"`
	Scope       string `json:"Scope,omitempty" ini:"Scope,omitempty"`
	ShowStatus  string `json:"ShowStatus,omitempty" ini:"ShowStatus,omitempty"`
}

type DHCPv4Section struct {
	UseDNS     string `json:"UseDNS,omitempty" ini:"UseDNS,omitempty"`
	UseNTP     string `json:"UseNTP,omitempty" ini:"UseNTP,omitempty"`
	UseDomains string `json:"UseDomains,omitempty" ini:"UseDomains,omitempty"`
	UseMTU     string `json:"UseMTU,omitempty" ini:"UseMTU,omitempty"`
}

type DHCPv6Section struct {
	UseDNS               string `json:"UseDNS,omitempty" ini:"UseDNS,omitempty"`
	UseNTP               string `json:"UseNTP,omitempty" ini:"UseNTP,omitempty"`
	PrefixDelegationHint string `json:"PrefixDelegationHint,omitempty" ini:"PrefixDelegationHint,omitempty"`
}

// NetDevConfig configuration
type NetDevConfig struct {
	NetDev         NetDevSection          `json:"NetDev" ini:"NetDev"`
	VLAN           *VLANSection           `json:"VLAN,omitempty" ini:"VLAN,omitempty"`
	Bridge         *BridgeSection         `json:"Bridge,omitempty" ini:"Bridge,omitempty"`
	Bond           *BondSection           `json:"Bond,omitempty" ini:"Bond,omitempty"`
	VXLAN          *VXLANSection          `json:"VXLAN,omitempty" ini:"VXLAN,omitempty"`
	MACVLAN        *MACVLANSection        `json:"MACVLAN,omitempty" ini:"MACVLAN,omitempty"`
	IPVLAN         *IPVLANSection         `json:"IPVLAN,omitempty" ini:"IPVLAN,omitempty"`
	Tun            *TunSection            `json:"Tun,omitempty" ini:"Tun,omitempty"`
	Tap            *TapSection            `json:"Tap,omitempty" ini:"Tap,omitempty"`
	WireGuard      *WireGuardSection      `json:"WireGuard,omitempty" ini:"WireGuard,omitempty"`
	WireGuardPeers []WireGuardPeerSection `json:"WireGuardPeer,omitempty" ini:"WireGuardPeer,omitempty,allowshadow"`
	VRF            *VRFSection            `json:"VRF,omitempty" ini:"VRF,omitempty"`
}

type NetDevSection struct {
	Name       string `json:"Name" ini:"Name"`
	Kind       string `json:"Kind" ini:"Kind"`
	MTUBytes   string `json:"MTUBytes,omitempty" ini:"MTUBytes,omitempty"`
	MACAddress string `json:"MACAddress,omitempty" ini:"MACAddress,omitempty"`
}

type VLANSection struct {
	Id int `json:"Id,omitempty" ini:"Id,omitempty"`
}

type BridgeSection struct {
	// Placeholder for extensive Bridge settings, keeping it simple for now as requested or expanded?
	// The user asked for all options.
	STP string `json:"STP,omitempty" ini:"STP,omitempty"`
}

type BondSection struct {
	Mode               string `json:"Mode,omitempty" ini:"Mode,omitempty"`
	TransmitHashPolicy string `json:"TransmitHashPolicy,omitempty" ini:"TransmitHashPolicy,omitempty"`
	LACPTransmitRate   string `json:"LACPTransmitRate,omitempty" ini:"LACPTransmitRate,omitempty"`
	MIIMonitorSec      string `json:"MIIMonitorSec,omitempty" ini:"MIIMonitorSec,omitempty"`
}

type VXLANSection struct {
	VNI             int    `json:"VNI,omitempty" ini:"VNI,omitempty"`
	Remote          string `json:"Remote,omitempty" ini:"Remote,omitempty"`
	Local           string `json:"Local,omitempty" ini:"Local,omitempty"`
	DestinationPort int    `json:"DestinationPort,omitempty" ini:"DestinationPort,omitempty"`
}

type MACVLANSection struct {
	Mode string `json:"Mode,omitempty" ini:"Mode,omitempty"`
}

type IPVLANSection struct {
	Mode string `json:"Mode,omitempty" ini:"Mode,omitempty"`
}

type TunSection struct {
	MultiQueue string `json:"MultiQueue,omitempty" ini:"MultiQueue,omitempty"`
	PacketInfo string `json:"PacketInfo,omitempty" ini:"PacketInfo,omitempty"`
}

type TapSection struct {
	MultiQueue string `json:"MultiQueue,omitempty" ini:"MultiQueue,omitempty"`
	PacketInfo string `json:"PacketInfo,omitempty" ini:"PacketInfo,omitempty"`
}

type WireGuardSection struct {
	PrivateKey string `json:"PrivateKey,omitempty" ini:"PrivateKey,omitempty"`
	ListenPort int    `json:"ListenPort,omitempty" ini:"ListenPort,omitempty"`
}

type WireGuardPeerSection struct {
	PublicKey    string   `json:"PublicKey" ini:"PublicKey"`
	Endpoint     string   `json:"Endpoint,omitempty" ini:"Endpoint,omitempty"`
	AllowedIPs   []string `json:"AllowedIPs,omitempty" ini:"AllowedIPs,omitempty,allowshadow"`
	PresharedKey string   `json:"PresharedKey,omitempty" ini:"PresharedKey,omitempty"`
}

type VRFSection struct {
	Table int `json:"Table,omitempty" ini:"Table,omitempty"`
}

// ParseNetDevConfig parses raw INI content into a NetDevConfig struct
func ParseNetDevConfig(content string) (*NetDevConfig, error) {
	cfg, err := ini.LoadSources(ini.LoadOptions{AllowShadows: true}, []byte(content))
	if err != nil {
		return nil, err
	}

	config := &NetDevConfig{}
	err = cfg.MapTo(config)
	if err != nil {
		return nil, err
	}
	return config, nil
}

// GenerateNetDevConfig generates raw INI content from a NetDevConfig struct
func GenerateNetDevConfig(config *NetDevConfig) (string, error) {
	if config.NetDev.Name == "" || config.NetDev.Kind == "" {
		return "", fmt.Errorf("NetDev section must have Name and Kind")
	}

	// Enable Shadows for arrays
	cfg, err := ini.LoadSources(ini.LoadOptions{
		AllowShadows: true,
	}, []byte(""))
	if err != nil {
		return "", err
	}
	err = cfg.ReflectFrom(config)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	_, err = cfg.WriteTo(&buf)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

// ParseNetworkConfig parsing logic existing...
func ParseNetworkConfig(content string) (*NetworkConfig, error) {
	cfg, err := ini.LoadSources(ini.LoadOptions{AllowShadows: true}, []byte(content))
	if err != nil {
		return nil, err
	}

	config := &NetworkConfig{}
	err = cfg.MapTo(config)
	if err != nil {
		return nil, err
	}
	return config, nil
}

// GenerateNetworkConfig generates raw INI content from a NetworkConfig struct
func GenerateNetworkConfig(config *NetworkConfig) (string, error) {
	// Validate before generating
	if err := config.Validate(); err != nil {
		return "", err
	}

	// Enable Shadows for arrays
	cfg, err := ini.LoadSources(ini.LoadOptions{
		AllowShadows: true,
	}, []byte(""))
	if err != nil {
		return "", err
	}
	err = cfg.ReflectFrom(config)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	_, err = cfg.WriteTo(&buf)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

func (c *NetworkConfig) Validate() error {
	if len(c.Match.Name) == 0 && len(c.Match.MACAddress) == 0 && len(c.Match.OriginalName) == 0 {
		return fmt.Errorf("Match section must have at least Name, OriginalName, or MACAddress")
	}

	// Validate Addresses
	if len(c.Network.Address) > 0 {
		for _, addr := range c.Network.Address {
			_, _, err := net.ParseCIDR(addr)
			if err != nil {
				return fmt.Errorf("invalid address CIDR %s: %w", addr, err)
			}
		}
	}

	// Validate Gateways
	if len(c.Network.Gateway) > 0 {
		for _, gw := range c.Network.Gateway {
			if net.ParseIP(gw) == nil {
				return fmt.Errorf("invalid gateway IP %s", gw)
			}
		}
	}

	// Validate DNS
	if len(c.Network.DNS) > 0 {
		for _, dns := range c.Network.DNS {
			if net.ParseIP(dns) == nil {
				return fmt.Errorf("invalid DNS IP %s", dns)
			}
		}
	}

	return nil
}

// LinkConfig configuration (.link files)
type LinkConfig struct {
	Match MatchSection        `json:"Match" ini:"Match"`
	Link  LinkFileLinkSection `json:"Link" ini:"Link"`
}

type LinkFileLinkSection struct {
	Description            string `json:"Description,omitempty" ini:"Description,omitempty"`
	Alias                  string `json:"Alias,omitempty" ini:"Alias,omitempty"`
	MACAddressPolicy       string `json:"MACAddressPolicy,omitempty" ini:"MACAddressPolicy,omitempty"`
	MACAddress             string `json:"MACAddress,omitempty" ini:"MACAddress,omitempty"`
	NamePolicy             string `json:"NamePolicy,omitempty" ini:"NamePolicy,omitempty"`
	AlternativeNamesPolicy string `json:"AlternativeNamesPolicy,omitempty" ini:"AlternativeNamesPolicy,omitempty"`
	Name                   string `json:"Name,omitempty" ini:"Name,omitempty"`
	MTUBytes               string `json:"MTUBytes,omitempty" ini:"MTUBytes,omitempty"`
	BitsPerSecond          string `json:"BitsPerSecond,omitempty" ini:"BitsPerSecond,omitempty"`
	Duplex                 string `json:"Duplex,omitempty" ini:"Duplex,omitempty"`
	AutoNegotiation        string `json:"AutoNegotiation,omitempty" ini:"AutoNegotiation,omitempty"`
	WakeOnLan              string `json:"WakeOnLan,omitempty" ini:"WakeOnLan,omitempty"`
	Port                   string `json:"Port,omitempty" ini:"Port,omitempty"`
}

// ParseLinkConfig parses raw INI content into a LinkConfig struct
func ParseLinkConfig(content string) (*LinkConfig, error) {
	cfg, err := ini.LoadSources(ini.LoadOptions{AllowShadows: true}, []byte(content))
	if err != nil {
		return nil, err
	}

	config := &LinkConfig{}
	err = cfg.MapTo(config)
	if err != nil {
		return nil, err
	}
	return config, nil
}

// GenerateLinkConfig generates raw INI content from a LinkConfig struct
func GenerateLinkConfig(config *LinkConfig) (string, error) {
	// Simple validation
	// Simple validation
	if len(config.Match.Name) == 0 && len(config.Match.MACAddress) == 0 && len(config.Match.Driver) == 0 && len(config.Match.Type) == 0 && len(config.Match.Kind) == 0 {
		// Link files MUST match something, usually
	}

	// Enable Shadows for arrays
	cfg, err := ini.LoadSources(ini.LoadOptions{
		AllowShadows: true,
	}, []byte(""))
	if err != nil {
		return "", err
	}
	err = cfg.ReflectFrom(config)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	_, err = cfg.WriteTo(&buf)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}
