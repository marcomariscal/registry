// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";
import "hardhat/console.sol";

/// @title Vault2
/// @author M
/// @notice Automated market maker that facilitates trades between two ERC20 tokens
/// @notice Uses k = x * y
contract Amm is ERC20 {
    event Liquidity(address _sender, uint256 _x, uint256 _y, uint256 _ammTokens);
    event SellX(address _sender, uint256 _x, uint256 _yReceived);
    event SellY(address _sender, uint256 _y, uint256 _xReceived);

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
        k = _x * _y;

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
    /// @param _x the amount of x supplied
    /// @param _y the amount of y supplied
    function mint(uint256 _x, uint256 _y) public returns (uint256) {
        // calculate sent ratio
        uint256 sentRatio = _x / _y;

        // calculate reserves ratio
        uint256 ratio = xReserves / yReserves;

        // make sure sent ratio matches amm ratio
        require(sentRatio == ratio, "ratio of sent tokens does not match amm");

        // calculate the amount of liquidity tokens to mint based on _x supplied to the current x reserves
        uint256 minted = (_x / xReserves) * k;

        // update reserves
        xReserves += _x;
        yReserves += _y;

        // update k
        k = xReserves * yReserves;

        // transfer tokens to this contract
        xToken.transferFrom(msg.sender, address(this), _x);
        yToken.transferFrom(msg.sender, address(this), _y);

        // mint amm tokens to sender
        _mint(msg.sender, minted);

        emit Liquidity(msg.sender, _x, _y, minted);

        return minted;
    }

    /// @notice burns amm tokens after receiving from sender
    /// @param _amount the amount of amm tokens to be burned
    function burn(uint256 _amount) public {
        // ratio of amount to burn to total supply
        uint256 ratio = _amount / this.totalSupply();
        _burn(msg.sender, _amount);

        // update k
        k = xReserves * yReserves;

        // send x and y tokens to sender
        uint256 xToSend = xReserves * ratio;
        uint256 yToSend = yReserves * ratio;
        xToken.transfer(msg.sender, xToSend);
        yToken.transfer(msg.sender, yToSend);
    }

    /// @notice sell x: user provides amount of x token to swap for y token
    /// @param _amount the amount of x to swap for y
    /// @return amount of y sent to user
    function sellX(uint256 _amount) public returns (uint256) {
        require(_amount < yReserves, "not enough y reserves");

        // x * y = k
        // y = k / x
        // calculate new reserves
        uint256 newXReserves = xReserves + _amount;
        uint256 newYReserves = k / newXReserves;

        // calculate amount of y to send
        uint256 amountToSend = yReserves - newYReserves;

        // update reserves
        xReserves = newXReserves;
        yReserves = newYReserves;

        // calculate new k
        uint256 newK = xReserves * yReserves;

        // make sure k stays the same
        require(k == newK, "k after swap needs to match current k");

        xToken.transferFrom(msg.sender, address(this), _amount);
        yToken.transfer(msg.sender, amountToSend);

        emit SellX(msg.sender, _amount, amountToSend);

        return amountToSend;
    }

    /// @notice sell y: user provides amount of y token to swap for x token
    /// @param _amount the amount of y to swap for x
    /// @return amount of x sent to user
    function sellY(uint256 _amount) public returns (uint256) {
        require(_amount < xReserves, "not enough x reserves");

        // x * y = k
        // x = k / y
        // calculate new reserves
        uint256 newYReserves = yReserves + _amount;
        uint256 newXReserves = k / newYReserves;

        // calculate amount of x to send
        uint256 amountToSend = xReserves - newXReserves;

        // update current reserves
        xReserves = newXReserves;
        yReserves = newYReserves;

        // calculate new k
        uint256 newK = xReserves * yReserves;

        // make sure k stays the same
        require(k == newK, "k after swap needs to match current k");

        yToken.transferFrom(msg.sender, address(this), _amount);
        xToken.transfer(msg.sender, amountToSend);

        emit SellY(msg.sender, _amount, amountToSend);

        return amountToSend;
    }
}
