// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
import "./Vault2.sol";

/// @title Vault2
/// @author M
/// @notice Vault where users can deposit and withdraw their vault's balance of a specific token
/// @notice shares are minted and burned in proportion to an arbitrary value (exchange rate) set by the contract owner
/// @notice if exchange rate is 1 * 10**18, that is equivalent to a ratio/exchange rate of "1"
contract Vault3 is ERC20 {
    event Deposit(address sender, uint256 _amount);
    event Withdraw(address sender, uint256 _amount);

    using FPMath for uint256;
    IERC20 public token;
    address public owner;
    mapping(address => uint256) public balances;

    uint256 public exchangeRate; // arbitrary exchange rate used to calculate how many vault tokens to mint

    constructor(
        address _token,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol, _decimals) {
        token = IERC20(_token);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function setExchangeRate(uint256 _exchangeRate) public onlyOwner {
        exchangeRate = _exchangeRate;
    }

    /// @notice user transfers amount to this contract
    /// @notice contract distributes token based on amount multiplied by exchange rate
    /// @param _amount the amount to deposit
    function deposit(uint256 _amount) public {
        require(_amount > 0, "amount should be greater than 0");
        uint256 ratioAmount = _amount.multiply(exchangeRate);
        balances[msg.sender] += ratioAmount;

        _mint(msg.sender, ratioAmount);

        token.transferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _amount);
    }

    /// @notice withdraws _amount from the contract and updates the user's vault balance
    /// @dev ensure the _amount can be withdrawn and burn representative balance
    /// @param _amount the amount to withdraw
    function withdraw(uint256 _amount) public {
        uint256 balance = balances[msg.sender];
        require(balance >= _amount, "amount greater than vault balance");
        balances[msg.sender] = balance - _amount;

        _burn(msg.sender, _amount);

        token.transfer(msg.sender, _amount);

        emit Withdraw(msg.sender, _amount);
    }
}

library FPMath {
    function multiply(uint256 _x, uint256 _y) public pure returns (uint256) {
        return ((_x * _y) / 1) * 10**18;
    }
}
