import { ActionTree, MutationTree } from 'vuex';
import { RootState } from '../index.type';
import { CartState, LineItem } from './cart.types';
import ShopifyClient from '../../services/shopifyClient';
import isLocalStorageAvailable from '../../services/localStorageCheck';

// getters
const getters = {

  cartVisibility: (state: CartState) => state.visibility,

  cartItems: (state: CartState) => state.items,

  cartProductsCount: (state: CartState) => {
    let productCount = 0;
    state.items.forEach((element : LineItem) => {
      productCount += element.quantity;
    });
    return productCount;
  },

  cartSubtotalPrice: (state: CartState) => state.subtotalPrice,

  cartTotalPrice: (state: CartState) => state.totalPrice,

  cartTotalTax: (state: CartState) => state.totalTax,

  cartWebUrl: (state: CartState) => state.webUrl,

};

// actions
const actions: ActionTree<CartState, RootState> = {

  ToggleCartVisibility({ commit }) {
    commit('TOGGLE_CART_VISIBILITY');
  },

  // Add a line item to the vuex cart
  // This will then trigger a mutation call to Shopify's
  // checkout api
  // Calling function should provide a variant ID and the quantity to add
  // in the form of a line item object
  addLineItemToCart({ state, commit }, payload) {
    // TODO: Check inputs are valid
    // Call the ShopifyClient object which adds a variant to the checkout
    ShopifyClient.addVariantToCart({
      checkoutId: state.id,
      variantId: payload.variantId,
      quantity: payload.quantity,
    }, (returnPayload: any) => {
      commit('SET_CART_PRICES', {
        subtotalPrice: returnPayload.subtotalPrice,
        totalTax: returnPayload.totalTax,
        totalPrice: returnPayload.totalPrice,
      });
      commit('SET_LINE_ITEMS', returnPayload.lineItems);
    }, () => {
      // TO DO: Add error processing
      console.info('Vuex Action Failed: addLineItemToCart');
    });

    /*
    // Check to see if the variant is already in the cart
    const foundIndex = state.items.findIndex((item) => item.variantId === lineItem.variantId);
    if (foundIndex !== -1) {
      // Variant is already in the cart
      // Use the update cart mutation to adjust
      // the quantity in the cart
      const payload = {
        variantId: lineItem.variantId,
        quantityChange: lineItem.quantity,
      };
      commit('UPDATE_LINE_ITEM_QUANTITY', payload);
    } else {
      // Variant is not in the cart
      // Just add the line item
      ShopifyClient.addVariantToCart(state.id, lineItem, (payload: any) => {
        commit('ADD_LINE_ITEM', lineItem);
      }, () => {
        // TO DO: Add error processing
        console.log('ERROR');
      });
    }
    */
  },

  // Remove a line item from the vuex cart
  // This will then trigger a mutation call to Shopify's
  // checkout api
  // Calling function should provide a Line Item ID that we want to remove
  removeLineItemFromCart({ state, commit }, id: string) {
    // TODO: Check input is valid
    // Call the ShopifyClient object which removes the line item from the cart
    ShopifyClient.removeCheckoutLineItem({
      checkoutId: state.id,
      lineItemId: id,
    }, (returnPayload: any) => {
      commit('SET_CART_PRICES', {
        subtotalPrice: returnPayload.subtotalPrice,
        totalTax: returnPayload.totalTax,
        totalPrice: returnPayload.totalPrice,
      });
      commit('SET_LINE_ITEMS', returnPayload.lineItems);
    }, () => {
      // TO DO: Add error processing
      console.info('Vuex Action Failed: removeLineItemFromCart');
    });
  },

  // Update the quantity of a line item in the vuex cart
  // This will then trigger a mutation call to Shopify's
  // checkout api
  // Calling function should provide a variant ID and the quantity to add
  // or remove
  updateLineItemQuantityInCart({ state, commit },
    payload: { id: string, variantId: string, quantityChange: number }) {
    const foundIndex = state.items.findIndex((item) => item.id === payload.id);

    if (foundIndex !== -1) {
      ShopifyClient.updateCheckoutLineItem({
        checkoutId: state.id,
        lineItem: {
          id: payload.id,
          variantId: payload.variantId,
          quantity: state.items[foundIndex].quantity + payload.quantityChange,
        },
      }, (returnPayload: any) => {
        commit('SET_CART_PRICES', {
          subtotalPrice: returnPayload.subtotalPrice,
          totalTax: returnPayload.totalTax,
          totalPrice: returnPayload.totalPrice,
        });
        commit('SET_LINE_ITEMS', returnPayload.lineItems);
      }, () => {
        // TO DO: Add error processing
        console.info('Vuex Action Failed: updateLineItemQuantityInCart');
      });
    }
  },

  // Get the cart object from the Shopify API
  // https://github.com/Shopify/storefront-api-examples/issues/30
  createNewCart({ commit }) {
    // Get the cart id and other cart info from the ShopifyClient Service
    // and the commit the data to the Cart Store
    ShopifyClient.createCheckout((payload: any) => {
      commit('SET_CART_CHECKOUT_ID', payload.id);
      commit('SET_CART_WEB_URL', payload.webUrl);
      commit('SET_CART_PRICES', {
        subtotalPrice: payload.subtotalPrice,
        totalTax: payload.totalTax,
        totalPrice: payload.totalPrice,
      });
      // Set the local storage cart it
      if (isLocalStorageAvailable()) {
        window.localStorage.setItem('shopify_checkout_id', payload.id);
      }
    }, () => {
      // TO DO: Add error processing
      console.log('ERROR');
    });
  },

  // Get the cart object from the Shopify API
  // https://github.com/Shopify/storefront-api-examples/issues/30
  fetchExistingCart({ commit }, checkoutId: string) {
    console.log('Fetching cart', checkoutId);
    ShopifyClient.fetchExistingCart({ checkoutId }, (returnPayload: any) => {
      commit('SET_CART_CHECKOUT_ID', returnPayload.id);
      commit('SET_CART_WEB_URL', returnPayload.webUrl);
      commit('SET_CART_PRICES', {
        subtotalPrice: returnPayload.subtotalPrice,
        totalTax: returnPayload.totalTax,
        totalPrice: returnPayload.totalPrice,
      });
      commit('SET_LINE_ITEMS', returnPayload.lineItems);
    }, () => {
      console.log('ERROR Fetching Cart');
    });
  },

  // Initialise the cart in vuex by first checking to see if a cart id
  // is in the localstorage. If it is, try to fetch the cart. If both
  // don't succeed then create a new cart
  initialiseCart({ dispatch }) {
    let checkoutId : string | null = null;

    // Check the local storage to see if a cart object exists
    if (isLocalStorageAvailable()) {
      checkoutId = window.localStorage.getItem('shopify_checkout_id');
    }

    // If CheckoutId exists then try to fetch the cart otherwise create a new cart
    if (checkoutId === null || checkoutId === '') {
      dispatch('createNewCart');
    } else {
      dispatch('fetchExistingCart', checkoutId);
    }
  },

};

// mutations
const mutations: MutationTree<CartState> = {

  // Toggle the cart visibility flag
  TOGGLE_CART_VISIBILITY(state: CartState) {
    state.visibility = !state.visibility;
  },

  // Set the Cart Checkout ID
  SET_CART_CHECKOUT_ID(state: CartState, checkoutId: string) {
    if (checkoutId) {
      state.id = checkoutId;
    }
  },

  // Set the Cart Web URL
  SET_CART_WEB_URL(state: CartState, webUrl: string) {
    if (webUrl) {
      state.webUrl = webUrl;
    }
  },

  // Set the cart prices. Payload must provide:
  // Subtotal
  // Total Tax
  // Total Price
  SET_CART_PRICES(state: CartState, payload : {
    subtotalPrice : string,
    totalTax : string,
    totalPrice : string,
  }) {
    if (payload.subtotalPrice && payload.totalTax && payload.totalPrice) {
      state.subtotalPrice = payload.subtotalPrice;
      state.totalTax = payload.totalTax;
      state.totalPrice = payload.totalPrice;
    }
  },

  // Overwrite the existing line items with this new array
  // of line items
  SET_LINE_ITEMS(state: CartState, lineItems: LineItem[]) {
    // Remove the items in the existing array and add the new line items
    state.items.splice(0, state.items.length, ...lineItems);
  },

  UPDATE_LINE_ITEM_QUANTITY(state: CartState,
    payload: { variantId: string, quantityChange: number }) {
    // Always check to make sure the variantID is in the cart
    const foundIndex = state.items.findIndex((item) => item.variantId === payload.variantId);
    if (foundIndex !== -1) {
      state.items.splice(foundIndex, 1,
        {
          id: '',
          variantId: payload.variantId,
          quantity: state.items[foundIndex].quantity += payload.quantityChange,
        });
    }
  },

  ADD_LINE_ITEM(state: CartState, lineItem: LineItem) {
    state.items.push(lineItem);
  },

  REMOVE_LINE_ITEM(state: CartState, variantId: string) {
    const index = state.items.findIndex((element) => {
      console.log('Attempting to find cart item');
      return (element.variantId === variantId);
    });
    // Remove the line item
    if (index > -1) {
      state.items.splice(index, 1);
    }
  },
};

// initial state
const state: CartState = {
  visibility: false,
  items: [],
  id: '',
  webUrl: '',
  subtotalPrice: '',
  totalTax: '',
  totalPrice: '',
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
