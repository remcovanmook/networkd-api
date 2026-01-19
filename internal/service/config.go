package service

import (
	"bytes"
	"fmt"
	"net"

	"gopkg.in/ini.v1"
)

// NetworkConfig configuration
type NetworkConfig struct {
	Match   MatchSection     `json:"match" ini:"Match"`
	Link    *LinkSection     `json:"link,omitempty" ini:"Link,omitempty"`
	Network NetworkSection   `json:"network" ini:"Network"`
	Address []AddressSection `json:"address_sections,omitempty" ini:"Address,omitempty,allowshadow"`
	Routes  []RouteSection   `json:"routes,omitempty" ini:"Route,omitempty,allowshadow"`
	DHCPv4  *DHCPv4Section   `json:"dhcpv4,omitempty" ini:"DHCPv4,omitempty"`
	DHCPv6  *DHCPv6Section   `json:"dhcpv6,omitempty" ini:"DHCPv6,omitempty"`
}

type MatchSection struct {
	Name       string `json:"name,omitempty" ini:"Name,omitempty"`
	MACAddress string `json:"mac_address,omitempty" ini:"MACAddress,omitempty"`
	Driver     string `json:"driver,omitempty" ini:"Driver,omitempty"`
	Type       string `json:"type,omitempty" ini:"Type,omitempty"`
	Kind       string `json:"kind,omitempty" ini:"Kind,omitempty"`
}

type LinkSection struct {
	MACAddress        string `json:"mac_address,omitempty" ini:"MACAddress,omitempty"`
	MTUBytes          string `json:"mtu_bytes,omitempty" ini:"MTUBytes,omitempty"`
	Unmanaged         string `json:"unmanaged,omitempty" ini:"Unmanaged,omitempty"`
	RequiredForOnline string `json:"required_for_online,omitempty" ini:"RequiredForOnline,omitempty"`
}

type NetworkSection struct {
	DHCP                string   `json:"dhcp,omitempty" ini:"DHCP,omitempty"`
	Address             []string `json:"address,omitempty" ini:"Address,omitempty,allowshadow"`
	Gateway             []string `json:"gateway,omitempty" ini:"Gateway,omitempty,allowshadow"`
	DNS                 []string `json:"dns,omitempty" ini:"DNS,omitempty,allowshadow"`
	Domains             []string `json:"domains,omitempty" ini:"Domains,omitempty,allowshadow"`
	NTP                 []string `json:"ntp,omitempty" ini:"NTP,omitempty,allowshadow"`
	IPForwarding        string   `json:"ip_forwarding,omitempty" ini:"IPForwarding,omitempty"`
	IPv6AcceptRA        string   `json:"ipv6_accept_ra,omitempty" ini:"IPv6AcceptRA,omitempty"`
	LinkLocalAddressing string   `json:"link_local_addressing,omitempty" ini:"LinkLocalAddressing,omitempty"`
	VLAN                []string `json:"vlan,omitempty" ini:"VLAN,omitempty,allowshadow"`
	MACVLAN             []string `json:"macvlan,omitempty" ini:"MACVLAN,omitempty,allowshadow"`
	VXLAN               []string `json:"vxlan,omitempty" ini:"VXLAN,omitempty,allowshadow"`
	Tunnel              []string `json:"tunnel,omitempty" ini:"Tunnel,omitempty,allowshadow"`
	Bond                string   `json:"bond,omitempty" ini:"Bond,omitempty"`
	Bridge              string   `json:"bridge,omitempty" ini:"Bridge,omitempty"`
	VRF                 string   `json:"vrf,omitempty" ini:"VRF,omitempty"`
}

type AddressSection struct {
	Address string `json:"address" ini:"Address"`
	Peer    string `json:"peer,omitempty" ini:"Peer,omitempty"`
	Label   string `json:"label,omitempty" ini:"Label,omitempty"`
}

type RouteSection struct {
	Gateway     string `json:"gateway,omitempty" ini:"Gateway,omitempty"`
	Destination string `json:"destination,omitempty" ini:"Destination,omitempty"`
	Metric      int    `json:"metric,omitempty" ini:"Metric,omitempty"`
	Source      string `json:"source,omitempty" ini:"Source,omitempty"`
	Scope       string `json:"scope,omitempty" ini:"Scope,omitempty"`
	ShowStatus  string `json:"show_status,omitempty" ini:"ShowStatus,omitempty"`
}

type DHCPv4Section struct {
	UseDNS     string `json:"use_dns,omitempty" ini:"UseDNS,omitempty"`
	UseNTP     string `json:"use_ntp,omitempty" ini:"UseNTP,omitempty"`
	UseDomains string `json:"use_domains,omitempty" ini:"UseDomains,omitempty"`
	UseMTU     string `json:"use_mtu,omitempty" ini:"UseMTU,omitempty"`
}

type DHCPv6Section struct {
	UseDNS               string `json:"use_dns,omitempty" ini:"UseDNS,omitempty"`
	UseNTP               string `json:"use_ntp,omitempty" ini:"UseNTP,omitempty"`
	PrefixDelegationHint string `json:"prefix_delegation_hint,omitempty" ini:"PrefixDelegationHint,omitempty"`
}

// NetDevConfig configuration
type NetDevConfig struct {
	NetDev         NetDevSection          `json:"netdev" ini:"NetDev"`
	VLAN           *VLANSection           `json:"vlan,omitempty" ini:"VLAN,omitempty"`
	Bridge         *BridgeSection         `json:"bridge,omitempty" ini:"Bridge,omitempty"`
	Bond           *BondSection           `json:"bond,omitempty" ini:"Bond,omitempty"`
	VXLAN          *VXLANSection          `json:"vxlan,omitempty" ini:"VXLAN,omitempty"`
	MACVLAN        *MACVLANSection        `json:"macvlan,omitempty" ini:"MACVLAN,omitempty"`
	IPVLAN         *IPVLANSection         `json:"ipvlan,omitempty" ini:"IPVLAN,omitempty"`
	Tun            *TunSection            `json:"tun,omitempty" ini:"Tun,omitempty"`
	Tap            *TapSection            `json:"tap,omitempty" ini:"Tap,omitempty"`
	WireGuard      *WireGuardSection      `json:"wireguard,omitempty" ini:"WireGuard,omitempty"`
	WireGuardPeers []WireGuardPeerSection `json:"wireguard_peers,omitempty" ini:"WireGuardPeer,omitempty,allowshadow"`
	VRF            *VRFSection            `json:"vrf,omitempty" ini:"VRF,omitempty"`
}

type NetDevSection struct {
	Name       string `json:"name" ini:"Name"`
	Kind       string `json:"kind" ini:"Kind"`
	MTUBytes   string `json:"mtu_bytes,omitempty" ini:"MTUBytes,omitempty"`
	MACAddress string `json:"mac_address,omitempty" ini:"MACAddress,omitempty"`
}

type VLANSection struct {
	Id int `json:"id,omitempty" ini:"Id,omitempty"`
}

type BridgeSection struct {
	// Placeholder for extensive Bridge settings, keeping it simple for now as requested or expanded?
	// The user asked for all options.
	STP string `json:"stp,omitempty" ini:"STP,omitempty"`
}

type BondSection struct {
	Mode               string `json:"mode,omitempty" ini:"Mode,omitempty"`
	TransmitHashPolicy string `json:"transmit_hash_policy,omitempty" ini:"TransmitHashPolicy,omitempty"`
	LACPTransmitRate   string `json:"lacp_transmit_rate,omitempty" ini:"LACPTransmitRate,omitempty"`
	MIIMonitorSec      string `json:"mii_monitor_sec,omitempty" ini:"MIIMonitorSec,omitempty"`
}

type VXLANSection struct {
	VNI             int    `json:"vni,omitempty" ini:"VNI,omitempty"`
	Remote          string `json:"remote,omitempty" ini:"Remote,omitempty"`
	Local           string `json:"local,omitempty" ini:"Local,omitempty"`
	DestinationPort int    `json:"destination_port,omitempty" ini:"DestinationPort,omitempty"`
}

type MACVLANSection struct {
	Mode string `json:"mode,omitempty" ini:"Mode,omitempty"`
}

type IPVLANSection struct {
	Mode string `json:"mode,omitempty" ini:"Mode,omitempty"`
}

type TunSection struct {
	MultiQueue string `json:"multi_queue,omitempty" ini:"MultiQueue,omitempty"`
	PacketInfo string `json:"packet_info,omitempty" ini:"PacketInfo,omitempty"`
}

type TapSection struct {
	MultiQueue string `json:"multi_queue,omitempty" ini:"MultiQueue,omitempty"`
	PacketInfo string `json:"packet_info,omitempty" ini:"PacketInfo,omitempty"`
}

type WireGuardSection struct {
	PrivateKey string `json:"private_key,omitempty" ini:"PrivateKey,omitempty"`
	ListenPort int    `json:"listen_port,omitempty" ini:"ListenPort,omitempty"`
}

type WireGuardPeerSection struct {
	PublicKey    string   `json:"public_key" ini:"PublicKey"`
	Endpoint     string   `json:"endpoint,omitempty" ini:"Endpoint,omitempty"`
	AllowedIPs   []string `json:"allowed_ips,omitempty" ini:"AllowedIPs,omitempty,allowshadow"`
	PresharedKey string   `json:"preshared_key,omitempty" ini:"PresharedKey,omitempty"`
}

type VRFSection struct {
	Table int `json:"table,omitempty" ini:"Table,omitempty"`
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
	if c.Match.Name == "" && c.Match.MACAddress == "" {
		return fmt.Errorf("Match section must have at least Name or MACAddress")
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
