import {
  getInteractionId,
  getInteractionPriority,
  initializeInteraction,
  setInteractionId,
  setInteractionPriority,
} from '../ol-ext'
import { obsFromOlChangeEvent } from '../rx-ext'
import { pick, waitFor } from '../util/minilo'
import mergeDescriptors from '../util/multi-merge-descriptors'
import olCmp from './ol-cmp'
import stubVNode from './stub-vnode'

/**
 * Base interaction mixin.
 */
export default {
  mixins: [
    stubVNode,
    olCmp,
  ],
  stubVNode: {
    empty () {
      return this.vmId
    },
  },
  props: {
    /**
     * @type {boolean}
     */
    active: {
      type: Boolean,
      default: true,
    },
    /**
     * Priority of interactions in the event handling stream.
     * The higher the value, the sooner it will handle map event.
     * @type {number}
     */
    priority: {
      type: Number,
      default: 0,
    },
  },
  watch: {
    id (value) {
      this.setInteractionId(value)
    },
    active (value) {
      this.setInteractionActive(value)
    },
    priority (value) {
      this.setInteractionPriority(value)
    },
  },
  created () {
    this::defineServices()
  },
  methods: {
    /**
     * @return {Promise<module:ol/interaction/Interaction~Interaction>}
     * @protected
     */
    async createOlObject () {
      const interaction = await this.createInteraction()

      initializeInteraction(interaction, this.id, this.priority)
      interaction.setActive(this.active)

      return interaction
    },
    /**
     * @return {module:ol/interaction/Interaction~Interaction|Promise<module:ol/interaction/Interaction~Interaction>}
     * @protected
     * @abstract
     */
    createInteraction () {
      throw new Error('Not implemented method')
    },
    /**
     * @returns {Promise<string|number>}
     */
    async getInteractionId () {
      return getInteractionId(await this.resolveInteraction())
    },
    /**
     * @param {string|number} id
     * @returns {Promise<void>}
     */
    async setInteractionId (id) {
      const interaction = await this.resolveInteraction()

      if (id === getInteractionId(interaction)) return

      setInteractionId(interaction, id)
    },
    /**
     * @returns {Promise<boolean>}
     */
    async getInteractionActive () {
      return (await this.resolveInteraction()).getActive()
    },
    /**
     * @param {boolean} active
     * @returns {Promise<void>}
     */
    async setInteractionActive (active) {
      const interaction = await this.resolveInteraction()

      if (active === interaction.getActive()) return

      interaction.setActive(active)
    },
    /**
     * @returns {Promise<number>}
     */
    async getInteractionPriority () {
      return getInteractionPriority(await this.resolveInteraction())
    },
    /**
     * @param {number} priority
     * @returns {Promise<void>}
     */
    async setInteractionPriority (priority) {
      const interaction = await this.resolveInteraction()

      if (priority === getInteractionPriority(interaction)) return

      setInteractionPriority(interaction, priority)
      // eslint-disable-next-line no-unused-expressions
      this.$interactionsContainer?.sortInteractions()
    },
    /**
     * @returns {Promise<void>}
     * @protected
     */
    async init () {
      await waitFor(() => this.$mapVm != null)

      return this::olCmp.methods.init()
    },
    /**
     * @return {void}
     * @protected
     */
    async mount () {
      if (this.$interactionsContainer) {
        await this.$interactionsContainer.addInteraction(this)
      }

      return this::olCmp.methods.mount()
    },
    /**
     * @return {void}
     * @protected
     */
    async unmount () {
      if (this.$interactionsContainer) {
        await this.$interactionsContainer.removeInteraction(this)
      }

      return this::olCmp.methods.unmount()
    },
    /**
     * @returns {Object}
     * @protected
     */
    getServices () {
      const vm = this

      return mergeDescriptors(
        this::olCmp.methods.getServices(),
        {
          get interactionVm () { return vm },
        },
      )
    },
    /**
     * @returns {Promise<void>}
     */
    async subscribeAll () {
      await Promise.all(
        this::olCmp.methods.subscribeAll(),
        this::subscribeToInteractionEvents(),
      )
    },
    resolveInteraction: olCmp.methods.resolveOlObject,
    ...pick(olCmp.methods, [
      'deinit',
      'refresh',
      'scheduleRefresh',
      'recreate',
      'scheduleRecreate',
      'remount',
      'scheduleRemount',
    ]),
  },
}

function defineServices () {
  Object.defineProperties(this, {
    /**
     * @type {module:ol/interaction/Interaction~Interaction|undefined}
     */
    $interaction: {
      enumerable: true,
      get: () => this.$olObject,
    },
    /**
     * @type {Object|Vue|undefined}
     */
    $mapVm: {
      enumerable: true,
      get: () => this.$services?.mapVm,
    },
    /**
     * @type {module:ol/View~View|undefined}
     */
    $view: {
      enumerable: true,
      get: () => this.$mapVm?.$view,
    },
    /**
     * @type {Object|Vue|undefined}
     */
    $interactionsContainer: {
      enumerable: true,
      get: () => this.$services?.interactionsContainer,
    },
  })
}

async function subscribeToInteractionEvents () {
  const interaction = await this.resolveInteraction()

  const changes = obsFromOlChangeEvent(interaction, [
    'id',
    'active',
    'priority',
  ], true, 1000 / 60)

  this.subscribeTo(changes, ({ prop, value }) => {
    ++this.rev

    this.$nextTick(() => {
      this.$emit(`update:${prop}`, value)
    })
  })
}
