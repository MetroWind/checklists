let e = React.createElement;

// Take parsed YAML data, render markdown, and add boolean to denote
// weather an item is checked or not. This function modifies the
// argument in-place, and also returns it.
function convertData(data)
{
    for(var page of data.pages)
    {
        for(var section of page.sections)
        {
            for(var i = 0; i < section.items.length; i++)
            {
                section.items[i] = {
                    text: marked.parse(section.items[i]),
                    checked: false,
                };
            }
        }
    }
    return data;
}

function applyCheckedState(page, checked_list)
{
    var i = 0;
    for(var section of page.sections)
    {
        for(var item of section.items)
        {
            item.checked = checked_list[i];
            i++;
        }
    }
}

function extractCheckedState(page)
{
    var bools = [];
    for(var section of page.sections)
    {
        for(var item of section.items)
        {
            bools.push(item.checked);
        }
    }
    return bools;
}

function packBools(bools)
{
    var base = 1;
    var xs = [];
    var x = 0;
    var chars = "";
    for(var i = 0; i < bools.length; i++)
    {
        if(bools[i])
        {
            x += base;
        }
        base <<= 1;
        if(base >= 256)
        {
            xs.push(x + 32);
            base = 1;
            x = 0;
        }
    }
    if(base != 1)
    {
        xs.push(x + 32);
    }
    return String.fromCharCode(...xs);
}

function unpackBools(s)
{
    var bools = [];
    for(var i = 0; i < s.length; i++)
    {
        var x = s.charCodeAt(i) - 32;
        for(var j = 0; j < 8; j++)
        {
            bools.push(x % 2 == 1);
            x >>= 1;
        }
    }
    return bools;
}

function saveKeyName(checklist_short_name, page_short_name)
{
    return `checklist-page_data-${checklist_short_name}-${page_short_name}`;
}

function savePageState(checklist_short_name, page)
{
    const save_data = packBools(extractCheckedState(page));
    localStorage.setItem(saveKeyName(checklist_short_name, page.short_name), save_data);
}

// ========== Views =================================================>

function CheckView({checked, onToggle})
{
    let outer = e("circle", {className: "CheckboxOuter", cx: 12, cy: 12, r: 10,
                             fill: "none", strokeWidth: 2});
    if(checked)
    {
        let inner = e("circle", {className: "CheckboxInner", cx: 12, cy: 12, r: 7,
                                 stroke: "none"});
        return e("svg", {viewBox: "0 0 24 24", width: 24, height: 24,
                         xmlns: "http://www.w3.org/2000/svg", onClick: onToggle},
                 e("g", {className: "CheckBox"}, outer, inner));
    }
    else
    {
        return e("svg", {viewBox: "0 0 24 24", width: 24, height: 24,
                         xmlns: "http://www.w3.org/2000/svg", onClick: onToggle},
                 e("g", {className: "CheckBox"}, outer));
    }
}

function ItemView({item, onToggle})
{
    // State can be “ready”, “config”, “loading”.
    const [checked, setChecked] = React.useState(item.checked);
    function onThisToggle()
    {
        const new_state = !checked;
        setChecked(new_state);
        item.checked = new_state;
        onToggle(new_state);
    }
    return e("div", {className: "Item"},
             e(CheckView, {checked: checked, onToggle: onThisToggle}),
             e("div", {className: "ItemDesc", dangerouslySetInnerHTML: {__html: item.text}}));
}

function SectionView({section, onChange})
{
    let views = section.items.map((item, i) =>
        e("li", {key: i},
          e(ItemView, {item: item, onToggle: onChange})));
    return e("section", {},
             e("h3", {dangerouslySetInnerHTML: {__html: section.title}}),
             e("ul", {}, views));
}

function PageView({checklist_short_name, page, onChange})
{
    function onPageChange()
    {
        onChange();
        savePageState(checklist_short_name, page);
    }
    let views = page.sections.map((sec, i) =>
        e(SectionView, {key: i, section: sec, onChange: onPageChange}));
    return e("div", {className: "Page"},
             e("h2", {dangerouslySetInnerHTML: {__html: page.title}}),
             views);
}

function AllPagesView({data})
{
    const [page_index, setPageIndex] = React.useState(0);
    const page_tabs = data.pages.map((page, i) => {
        if(i == page_index)
        {
            return e("li", {className: "PageTab CurrentTab", key: i}, page.short_name);
        }
        else
        {
            return e("li", {className: "PageTab", key: i},
                     e("a", {href: "#", onClick: () => { setPageIndex(i); }},
                       page.short_name));
        }
    });

    return e("div", {},
             e("header", {},
               e("h1", {}, data.title),
               e("ul", {id: "PageTabs"}, page_tabs)),
             e(PageView, {checklist_short_name: data.short_name,
                          page: data.pages[page_index],
                          onChange: () => {}}));
}

async function loadStates(data)
{
    for(var page of data.pages)
    {
        const saved = await localStorage.getItem(saveKeyName(data.short_name, page.short_name));
        if(saved !== null)
        {
            applyCheckedState(page, unpackBools(saved));
        }
    }
    return data;
}

async function loadData()
{
    let res = await fetch("checklist.yaml");
    if(!res.ok)
    {
        console.error("Fetch not ok.");
        return;
    }
    let body = await res.text();
    return convertData(window.yaml.parse(body));
}

async function run()
{
    let app_body = ReactDOM.createRoot(document.getElementById('AppWrapper'));
    let data = await loadData();
    let data_with_state = await loadStates(data);
    document.title = "Checklist: " + data.title;
    app_body.render(e(AllPagesView, { data: data_with_state }));
}

run();
