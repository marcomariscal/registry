// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";
import "hardhat/console.sol";

/// @title Amm
/// @author M
/// @notice Automated market maker that facilitates trades between two ERC20 tokens
/// @notice Uses k = x * y
contract Amm is ERC20 {
    event Liquidity(address sender, uint256 x, uint256 y, uint256 tokens);
    event Burn(address sender, uint256 tokens, uint256 xReceived, uint256 yReceived);
    event SellX(address sender, uint256 x, uint256 yReceived);
    event SellY(address sender, uint256 y, uint256 xReceived);

    IERC20 public xToken;
    IERC20 public yToken;

    uint256 public xReserves;
    uint256 public yReserves;
    uint256 public k;

    constructor(address _xToken, address _yToken)
        ERC20(
            string(
                abi.encodePacked(
                    IERC20Metadata(address(_xToken)).name(),
                    abi.encodePacked(IERC20Metadata(address(_yToken)).name()),
                    " LP"
                )
            ),
            string(
                abi.encodePacked(
                    IERC20Metadata(address(_xToken)).name(),
                    abi.encodePacked(IERC20Metadata(address(_yToken)).name()),
                    " LP"
                )
            ),
            18
        )
    {
        xToken = IERC20(_xToken);
        yToken = IERC20(_yToken);
    }

    /// @notice initializes k value
    /// @notice initializes amm and can only be called once
    /// @notice requires x and y to be in the same proportion on initialization
    /// @param _x the amount of x supplied
    /// @param _y the amount of y supplied
    /// @return number of amm tokens minted
    function init(uint256 _x, uint256 _y) public returns (uint256) {
        require(xReserves == 0, "pool already initialized");
        require(_x == _y, "x and y amounts should be the same");

        // initialize k
        k = (_x * _y) / 1e18;

        // update reserves
        xReserves = _x;
        yReserves = _y;

        // transfer tokens to this contract
        xToken.transferFrom(msg.sender, address(this), _x);
        yToken.transferFrom(msg.sender, address(this), _y);

        // mint k amm tokens to sender
        _mint(msg.sender, k);

        emit Liquidity(msg.sender, _x, _y, k);

        return k;
    }

    /// @notice mints amm tokens to sender for providing liquidity
    /// @param x the amount of x supplied
    /// @param y the amount of y supplied
    function mint(uint256 x, uint256 y) public returns (uint256) {
        uint256 xReserves_ = xReserves;
        require(xReserves_ > 0, "pool needs to be initialized");

        require(x / y == xReserves / yReserves, "reserve ratios need to stay the same");

        // calculate the amount of liquidity tokens to mint based on _x supplied to the current x reserves
        uint256 minted = (x * _totalSupply) / xReserves_;

        // update reserves
        xReserves += x;
        yReserves += y;

        // transfer tokens to this contract
        xToken.transferFrom(msg.sender, address(this), x);
        yToken.transferFrom(msg.sender, address(this), y);

        // mint amm tokens to sender
        _mint(msg.sender, minted);

        emit Liquidity(msg.sender, x, y, minted);

        return minted;
    }

    /// @notice burns amm tokens after receiving from sender
    /// @param wad the amount of amm tokens to be burned
    function burn(uint256 wad) public {
        uint256 xReserves_ = xReserves;
        require(xReserves_ > 0, "pool needs to be initialized");

        // ratio of amount to burn to total supply
        uint256 ratio = (wad) / _totalSupply;
        _burn(msg.sender, wad);

        // send x and y tokens to sender
        uint256 xToSend = xReserves_ * ratio;
        uint256 yToSend = yReserves * ratio;

        xReserves -= xToSend;
        yReserves -= yToSend;

        xToken.transfer(msg.sender, xToSend);
        yToken.transfer(msg.sender, yToSend);

        emit Burn(msg.sender, wad, xToSend, yToSend);
    }

    /// @notice sell x: user provides amount of x token to swap for y token
    /// @param wad the amount of x to swap for y
    /// @return amount of y sent to user
    function sellX(uint256 wad) public returns (uint256) {
        require(wad < yReserves, "not enough y reserves");

        // calculate new reserves
        uint256 newXReserves = xReserves + wad;
        uint256 newYReserves = (xReserves * yReserves) / newXReserves;

        // calculate amount of y to send
        uint256 amountToSend = yReserves - newYReserves;

        // update reserves
        xReserves = newXReserves;
        yReserves = newYReserves;

        xToken.transferFrom(msg.sender, address(this), wad);
        yToken.transfer(msg.sender, amountToSend);

        emit SellX(msg.sender, wad, amountToSend);

        return amountToSend;
    }

    /// @notice sell y: user provides amount of y token to swap for x token
    /// @param wad the amount of y to swap for x
    /// @return amount of x sent to user
    function sellY(uint256 wad) public returns (uint256) {
        require(wad < xReserves, "not enough x reserves");

        // calculate new reserves
        uint256 newYReserves = yReserves + wad;
        uint256 newXReserves = (xReserves * yReserves) / newYReserves;

        // calculate amount of x to send
        uint256 amountToSend = xReserves - newXReserves;

        // update current reserves
        xReserves = newXReserves;
        yReserves = newYReserves;

        yToken.transferFrom(msg.sender, address(this), wad);
        xToken.transfer(msg.sender, amountToSend);

        emit SellY(msg.sender, wad, amountToSend);

        return amountToSend;
    }
}
